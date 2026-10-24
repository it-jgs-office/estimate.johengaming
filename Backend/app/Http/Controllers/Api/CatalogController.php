<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Estimation;
use App\Models\EstimationSession;
use App\Models\Game;
use App\Models\GameItem;
use App\Models\PricingSetting;
use App\Models\Rarity;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CatalogController extends Controller
{
    public function bootstrap(Request $request)
    {
        return response()->json([
            'user' => $this->user($request),
            'games' => Game::query()->orderBy('name')->get()->map(fn (Game $game) => $this->game($game))->values(),
            'categories' => Category::query()->orderBy('name')->get()->map(fn (Category $category) => $this->category($category))->values(),
            'rarities' => Rarity::query()->orderBy('name')->get()->map(fn (Rarity $rarity) => $this->rarity($rarity))->values(),
            'items' => GameItem::query()->orderBy('name')->get()->map(fn (GameItem $item) => $this->item($item))->values(),
            'pricingSettings' => PricingSetting::query()->get()->map(fn (PricingSetting $setting) => $this->pricing($setting))->values(),
            'sessions' => EstimationSession::query()->where('user_id', $request->user()->id)->latest('updated_at')->get()->map(fn (EstimationSession $session) => $this->session($session))->values(),
            'estimations' => Estimation::query()->with('user')->where('user_id', $request->user()->id)->latest()->get()->map(fn (Estimation $estimation) => $this->estimation($estimation))->values(),
            'activityLogs' => [],
            'importBatches' => [],
        ]);
    }

    public function storeSession(Request $request)
    {
        $data = $request->validate([
            'id' => ['nullable', 'uuid'], 'gameId' => ['required', 'uuid', 'exists:games,id'], 'title' => ['required', 'string', 'max:255'],
            'messages' => ['required', 'array'], 'currentItems' => ['required', 'array'],
        ]);
        $session = EstimationSession::query()->firstOrNew(['id' => $data['id'] ?? null]);
        if ($session->exists && $session->user_id !== $request->user()->id) abort(403);
        $session->fill([
            'user_id' => $request->user()->id, 'game_id' => $data['gameId'], 'title' => $data['title'],
            'messages' => $data['messages'], 'current_items' => $data['currentItems'],
        ])->save();

        return response()->json(['session' => $this->session($session)]);
    }

    public function destroySession(Request $request, EstimationSession $session)
    {
        abort_unless($session->user_id === $request->user()->id, 403);
        $session->delete();
        return response()->noContent();
    }

    public function import(Request $request)
    {
        $data = $request->validate([
            'mode' => ['required', 'in:skip_duplicates,update_existing,import_new_only'],
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.game' => ['required', 'string', 'max:100'],
            'rows.*.category' => ['required', 'string', 'max:100'],
            'rows.*.rarity' => ['required', 'string', 'max:100'],
            'rows.*.estimatedCurrency' => ['required', 'integer', 'min:1'],
        ]);

        $created = 0;
        $updated = 0;
        $skipped = 0;
        foreach ($data['rows'] as $row) {
            $gameName = trim($row['game']);
            $game = Game::query()->whereRaw('lower(name) = ?', [strtolower($gameName)])->first();
            if (! $game) {
                $baseSlug = Str::slug($gameName) ?: 'game';
                $slug = $baseSlug;
                $counter = 2;
                while (Game::query()->where('slug', $slug)->exists()) $slug = $baseSlug.'-'.$counter++;
                $game = Game::query()->create(['name' => $gameName, 'slug' => $slug, 'currency_name' => 'Currency', 'currency_symbol' => 'C', 'default_conversion_rate' => 0, 'low_percentage' => 0, 'medium_percentage' => 0, 'high_percentage' => 0]);
                PricingSetting::query()->create(['game_id' => $game->id, 'currency_rate' => 0, 'low_percentage' => 0, 'medium_percentage' => 0, 'high_percentage' => 0]);
            }
            $category = Category::query()->firstOrCreate(['game_id' => $game->id, 'name' => trim($row['category'])], ['aliases' => []]);
            $rarity = Rarity::query()->firstOrCreate(['game_id' => $game->id, 'name' => trim($row['rarity'])], ['aliases' => []]);
            $item = GameItem::query()->where(['game_id' => $game->id, 'category_id' => $category->id, 'rarity_id' => $rarity->id])->first();
            if ($item && $data['mode'] !== 'update_existing') { $skipped++; continue; }
            if ($item) {
                $item->update(['name' => $category->name, 'estimated_currency' => $row['estimatedCurrency'], 'status' => 'active']);
                $updated++;
            } else {
                GameItem::query()->create(['game_id' => $game->id, 'category_id' => $category->id, 'rarity_id' => $rarity->id, 'name' => $category->name, 'estimated_currency' => $row['estimatedCurrency']]);
                $created++;
            }
        }

        return response()->json(['created' => $created, 'updated' => $updated, 'skipped' => $skipped]);
    }

    public function saveItem(Request $request)
    {
        $data = $request->validate([
            'id' => ['nullable', 'uuid'], 'gameId' => ['required', 'uuid', 'exists:games,id'],
            'categoryId' => ['required', 'uuid', 'exists:categories,id'], 'rarityId' => ['required', 'uuid', 'exists:rarities,id'],
            'estimatedCurrency' => ['required', 'integer', 'min:1'],
        ]);
        $item = isset($data['id']) ? GameItem::query()->findOrFail($data['id']) : new GameItem();
        abort_if($item->exists && $item->game_id !== $data['gameId'], 422);
        $category = Category::query()->findOrFail($data['categoryId']);
        abort_unless($category->game_id === $data['gameId'], 422);
        $item->fill(['game_id' => $data['gameId'], 'category_id' => $data['categoryId'], 'rarity_id' => $data['rarityId'], 'name' => $category->name, 'type' => 'standard', 'estimated_currency' => $data['estimatedCurrency'], 'status' => 'active'])->save();
        return response()->json(['item' => $this->item($item)]);
    }

    public function destroyItem(GameItem $item)
    {
        $item->delete();
        return response()->noContent();
    }

    public function destroyGame(Game $game)
    {
        $game->delete();
        return response()->noContent();
    }

    public function savePricing(Request $request)
    {
        $data = $request->validate([
            'gameId' => ['required', 'uuid', 'exists:games,id'], 'currencyRate' => ['required', 'numeric', 'min:0'],
            'lowPercentage' => ['required', 'numeric', 'min:0'], 'mediumPercentage' => ['required', 'numeric', 'min:0'],
            'highPercentage' => ['required', 'numeric', 'min:0'], 'roundingMode' => ['required', 'string'], 'defaultTier' => ['required', 'string'],
        ]);
        $setting = PricingSetting::query()->firstOrNew(['game_id' => $data['gameId']]);
        $setting->fill(['currency_rate' => $data['currencyRate'], 'low_percentage' => $data['lowPercentage'], 'medium_percentage' => $data['mediumPercentage'], 'high_percentage' => $data['highPercentage'], 'rounding_mode' => $data['roundingMode'], 'default_tier' => $data['defaultTier']])->save();
        Game::query()->whereKey($data['gameId'])->update(['default_conversion_rate' => $data['currencyRate'], 'low_percentage' => $data['lowPercentage'], 'medium_percentage' => $data['mediumPercentage'], 'high_percentage' => $data['highPercentage']]);
        return response()->json(['pricingSetting' => $this->pricing($setting)]);
    }

    public function saveEstimation(Request $request)
    {
        $data = $request->validate([
            'id' => ['required', 'string', 'max:80'], 'gameId' => ['required', 'uuid', 'exists:games,id'], 'title' => ['required', 'string', 'max:255'],
            'accountIdentifier' => ['nullable', 'string', 'max:255'], 'originalSpecification' => ['required', 'string'], 'totalCurrency' => ['required', 'integer', 'min:0'],
            'conversionRateSnapshot' => ['required', 'numeric', 'min:0'], 'lowPercentageSnapshot' => ['required', 'numeric', 'min:0'], 'mediumPercentageSnapshot' => ['required', 'numeric', 'min:0'], 'highPercentageSnapshot' => ['required', 'numeric', 'min:0'],
            'baseValue' => ['required', 'integer', 'min:0'], 'lowPrice' => ['required', 'integer', 'min:0'], 'mediumPrice' => ['required', 'integer', 'min:0'], 'highPrice' => ['required', 'integer', 'min:0'], 'notes' => ['nullable', 'string'], 'itemsSnapshot' => ['required', 'array'],
        ]);
        $estimation = Estimation::query()->firstOrNew(['id' => $data['id']]);
        abort_if($estimation->exists && $estimation->user_id !== $request->user()->id, 403);
        $estimation->fill(['user_id' => $request->user()->id, 'game_id' => $data['gameId'], 'title' => $data['title'], 'account_identifier' => $data['accountIdentifier'] ?? null, 'original_specification' => $data['originalSpecification'], 'total_currency' => $data['totalCurrency'], 'conversion_rate_snapshot' => $data['conversionRateSnapshot'], 'low_percentage_snapshot' => $data['lowPercentageSnapshot'], 'medium_percentage_snapshot' => $data['mediumPercentageSnapshot'], 'high_percentage_snapshot' => $data['highPercentageSnapshot'], 'base_value' => $data['baseValue'], 'low_price' => $data['lowPrice'], 'medium_price' => $data['mediumPrice'], 'high_price' => $data['highPrice'], 'notes' => $data['notes'] ?? null, 'items_snapshot' => $data['itemsSnapshot']])->save();
        return response()->json(['estimation' => $this->estimation($estimation->load('user'))]);
    }

    public function destroyEstimation(Request $request, Estimation $estimation)
    {
        abort_unless($estimation->user_id === $request->user()->id, 403);
        $estimation->delete();
        return response()->noContent();
    }

    private function user(Request $request): array
    {
        $user = $request->user();
        return ['id' => (string) $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role, 'status' => 'active', 'createdAt' => $user->created_at?->toISOString()];
    }

    private function game(Game $game): array
    {
        return ['id' => $game->id, 'name' => $game->name, 'slug' => $game->slug, 'icon' => $game->icon, 'currencyName' => $game->currency_name, 'currencySymbol' => $game->currency_symbol, 'defaultConversionRate' => (float) $game->default_conversion_rate, 'lowPercentage' => (float) $game->low_percentage, 'mediumPercentage' => (float) $game->medium_percentage, 'highPercentage' => (float) $game->high_percentage, 'status' => $game->status, 'createdAt' => $game->created_at?->toISOString(), 'updatedAt' => $game->updated_at?->toISOString()];
    }

    private function category(Category $category): array
    {
        return ['id' => $category->id, 'gameId' => $category->game_id, 'name' => $category->name, 'aliases' => $category->aliases ?? [], 'status' => $category->status];
    }

    private function rarity(Rarity $rarity): array
    {
        return ['id' => $rarity->id, 'gameId' => $rarity->game_id, 'name' => $rarity->name, 'aliases' => $rarity->aliases ?? [], 'status' => $rarity->status];
    }

    private function item(GameItem $item): array
    {
        return ['id' => $item->id, 'gameId' => $item->game_id, 'categoryId' => $item->category_id, 'rarityId' => $item->rarity_id, 'name' => $item->name, 'type' => $item->type, 'estimatedCurrency' => (int) $item->estimated_currency, 'aliases' => [], 'status' => $item->status, 'createdAt' => $item->created_at?->toISOString(), 'updatedAt' => $item->updated_at?->toISOString()];
    }

    private function pricing(PricingSetting $setting): array
    {
        return ['id' => $setting->id, 'gameId' => $setting->game_id, 'currencyRate' => (float) $setting->currency_rate, 'lowPercentage' => (float) $setting->low_percentage, 'mediumPercentage' => (float) $setting->medium_percentage, 'highPercentage' => (float) $setting->high_percentage, 'roundingMode' => $setting->rounding_mode, 'defaultTier' => $setting->default_tier, 'updatedAt' => $setting->updated_at?->toISOString()];
    }

    private function session(EstimationSession $session): array
    {
        return ['id' => $session->id, 'title' => $session->title, 'gameId' => $session->game_id, 'messages' => $session->messages ?? [], 'currentItems' => $session->current_items ?? [], 'createdAt' => $session->created_at?->toISOString(), 'updatedAt' => $session->updated_at?->toISOString()];
    }

    private function estimation(Estimation $estimation): array
    {
        return ['id' => $estimation->id, 'gameId' => $estimation->game_id, 'userId' => (string) $estimation->user_id, 'userName' => $estimation->user?->name ?? 'Administrator', 'title' => $estimation->title, 'accountIdentifier' => $estimation->account_identifier, 'originalSpecification' => $estimation->original_specification, 'totalCurrency' => (int) $estimation->total_currency, 'conversionRateSnapshot' => (float) $estimation->conversion_rate_snapshot, 'lowPercentageSnapshot' => (float) $estimation->low_percentage_snapshot, 'mediumPercentageSnapshot' => (float) $estimation->medium_percentage_snapshot, 'highPercentageSnapshot' => (float) $estimation->high_percentage_snapshot, 'baseValue' => (int) $estimation->base_value, 'lowPrice' => (int) $estimation->low_price, 'mediumPrice' => (int) $estimation->medium_price, 'highPrice' => (int) $estimation->high_price, 'notes' => $estimation->notes, 'itemsSnapshot' => $estimation->items_snapshot ?? [], 'createdAt' => $estimation->created_at?->toISOString(), 'updatedAt' => $estimation->updated_at?->toISOString()];
    }
}
