<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Game;
use App\Models\GameItem;
use App\Models\PricingSetting;
use App\Models\Rarity;
use App\Models\SpreadsheetSource;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class GoogleSpreadsheetCatalogSyncService
{
    public function sync(SpreadsheetSource $source): array
    {
        try {
            $matrix = $this->downloadMatrix($source->source_url);
            if (count($matrix) < 2 || count($matrix[0]) < 2) {
                throw new \RuntimeException('Spreadsheet harus memiliki header dan minimal satu baris data.');
            }

            $game = $this->findOrCreateGame($source->game_name, $source->currency_name);
            $result = $this->importMatrix($game, $matrix);
            $source->update(['last_synced_at' => now(), 'last_error' => null]);

            return $result;
        } catch (\Throwable $error) {
            $source->update(['last_error' => $error->getMessage()]);
            throw $error;
        }
    }

    private function downloadMatrix(string $sourceUrl): array
    {
        if (! preg_match('#docs\.google\.com/spreadsheets/d/([a-zA-Z0-9_-]+)#', $sourceUrl, $matches)) {
            throw new \RuntimeException('Gunakan link Google Spreadsheet publik yang valid.');
        }

        preg_match('/[?&#]gid=(\d+)/', $sourceUrl, $gidMatch);
        $exportUrl = "https://docs.google.com/spreadsheets/d/{$matches[1]}/export?format=csv&gid=".($gidMatch[1] ?? '0');
        $response = Http::timeout(20)->get($exportUrl);
        if ($response->failed() || str_starts_with(ltrim($response->body()), '<!DOCTYPE html')) {
            throw new \RuntimeException('Spreadsheet tidak dapat dibaca. Pastikan aksesnya publik untuk siapa saja yang memiliki link.');
        }

        $stream = fopen('php://temp', 'r+');
        fwrite($stream, $response->body());
        rewind($stream);
        $rows = [];
        while (($row = fgetcsv($stream)) !== false) {
            $rows[] = array_map(static fn ($cell) => trim((string) $cell), $row);
        }
        fclose($stream);

        return $rows;
    }

    private function findOrCreateGame(string $gameName, string $currencyName): Game
    {
        $game = Game::query()->whereRaw('lower(name) = ?', [strtolower(trim($gameName))])->first();
        if (! $game) {
            $baseSlug = Str::slug($gameName) ?: 'game';
            $slug = $baseSlug;
            $counter = 2;
            while (Game::query()->where('slug', $slug)->exists()) $slug = $baseSlug.'-'.$counter++;
            $game = Game::query()->create(['name' => trim($gameName), 'slug' => $slug, 'currency_name' => trim($currencyName), 'currency_symbol' => trim($currencyName), 'default_conversion_rate' => 0, 'low_percentage' => 0, 'medium_percentage' => 0, 'high_percentage' => 0]);
            PricingSetting::query()->create(['game_id' => $game->id, 'currency_rate' => 0, 'low_percentage' => 0, 'medium_percentage' => 0, 'high_percentage' => 0]);
        } elseif ($game->currency_name !== trim($currencyName) || $game->currency_symbol !== trim($currencyName)) {
            $game->update(['currency_name' => trim($currencyName), 'currency_symbol' => trim($currencyName)]);
        }

        return $game;
    }

    private function importMatrix(Game $game, array $matrix): array
    {
        $created = 0;
        $updated = 0;
        $headers = array_slice($matrix[0], 1);

        foreach (array_slice($matrix, 1) as $line) {
            $categoryName = trim((string) ($line[0] ?? ''));
            if ($categoryName === '') continue;

            foreach ($headers as $index => $header) {
                $cell = trim((string) ($line[$index + 1] ?? ''));
                if ($cell === '') continue;
                $header = trim((string) $header);
                $headerPrice = preg_match('/^\d[\d.,\s]*(?:VP)?$/i', $header) ? (int) preg_replace('/\D/', '', $header) : 0;
                $entries = $headerPrice > 0
                    ? preg_split('/\R/', $cell)
                    : [$header];

                foreach ($entries as $entry) {
                    $entry = trim($entry);
                    if ($entry === '') continue;
                    preg_match('/^(.*?)\s*=\s*(\d+)\s*$/', $entry, $explicitPrice);
                    $skinName = trim($explicitPrice[1] ?? $entry);
                    $price = isset($explicitPrice[2]) ? (int) $explicitPrice[2] : ($headerPrice ?: (int) preg_replace('/\D/', '', $cell));
                    if ($skinName === '' || $price <= 0) continue;

                    $category = Category::query()->firstOrCreate(['game_id' => $game->id, 'name' => $categoryName], ['aliases' => []]);
                    $rarity = Rarity::query()->firstOrCreate(['game_id' => $game->id, 'name' => $skinName], ['aliases' => []]);
                    $item = GameItem::query()->where(['game_id' => $game->id, 'category_id' => $category->id, 'rarity_id' => $rarity->id])->first();
                    $itemName = $headerPrice > 0 ? "{$categoryName} {$skinName}" : $categoryName;
                    if ($item) {
                        $item->update(['name' => $itemName, 'estimated_currency' => $price, 'status' => 'active']);
                        $updated++;
                    } else {
                        GameItem::query()->create(['game_id' => $game->id, 'category_id' => $category->id, 'rarity_id' => $rarity->id, 'name' => $itemName, 'estimated_currency' => $price]);
                        $created++;
                    }
                }
            }
        }

        return compact('created', 'updated');
    }
}
