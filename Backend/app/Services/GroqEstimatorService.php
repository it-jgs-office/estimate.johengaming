<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Game;
use App\Models\GameItem;
use App\Models\Rarity;
use Illuminate\Support\Facades\Http;

class GroqEstimatorService
{
    public function estimate(Game $game, string $message, array $history = []): array
    {
        $items = GameItem::query()->where('game_id', $game->id)->where('status', 'active')->get();
        $categories = Category::query()->where('game_id', $game->id)->get()->keyBy('id');
        $rarities = Rarity::query()->where('game_id', $game->id)->get()->keyBy('id');

        $catalog = $items->map(fn (GameItem $item) => [
            'id' => $item->id,
            'category' => $categories->get($item->category_id)?->name,
            'rarity' => $rarities->get($item->rarity_id)?->name,
            'currency' => (int) $item->estimated_currency,
        ])->values()->all();

        $systemPrompt = <<<'PROMPT'
Anda adalah Johen Price Estimator, asisten percakapan berbahasa Indonesia untuk estimasi akun game.

Tugas Anda memiliki tiga intent: "conversation" untuk obrolan, pertanyaan, judul, atau konteks singkat; "clarification" bila pengguna ingin estimasi tetapi datanya belum cukup; dan "estimate" hanya bila pengguna benar-benar memberi daftar/spesifikasi item akun.

Untuk conversation, jawab dengan ramah dan singkat. Anda boleh menjelaskan cara kerja estimator dan batasannya: harga hanya dihitung dari katalog game yang diberikan, Anda tidak boleh mengarang item, rarity, atau harga. Jangan mengeluarkan matches atau unknownItems untuk percakapan biasa, judul, salam, satu kata, atau kalimat yang bukan daftar item. Contoh "valoran kesatu", "akun saya", dan "halo" adalah conversation, BUKAN item yang perlu nilai manual.

Untuk clarification, jelaskan data apa yang dibutuhkan (kategori, rarity, atau jumlah) dan jangan mengeluarkan matches maupun unknownItems.

Pilih estimate hanya jika permintaan secara jelas menyebut koleksi/item akun. Cocokkan salah ketik, bahasa santai, singkatan, dan jumlah item ke katalog. Jangan mengarang kecocokan. unknownItems hanya boleh diisi untuk item akun yang konkret dan belum ada di katalog, bukan karena judul, nama akun, konteks, atau pesan ambigu. Jika ragu, pilih clarification dan unknownItems kosong. Gabungkan kecocokan item yang sama dengan menjumlahkan quantity.

Katalog bisa kosong. Jika pengguna meminta estimasi saat katalog kosong, jelaskan bahwa data Excel perlu diimpor; tetapi tetap tanggapi percakapan biasa dengan normal dan jangan meminta nilai manual.

Balas JSON valid saja dengan bentuk:
{"intent":"conversation|clarification|estimate","message":"balasan bahasa Indonesia","matches":[{"id":"id katalog","quantity":1}],"unknownItems":["item akun konkret yang belum ada di katalog"]}
PROMPT;

        $chatHistory = collect($history)
            ->filter(fn ($entry) => in_array($entry['role'] ?? null, ['user', 'assistant'], true) && is_string($entry['content'] ?? null))
            ->map(fn ($entry) => ['role' => $entry['role'], 'content' => $entry['content']])
            ->values()
            ->all();

        $response = Http::baseUrl('https://api.groq.com/openai/v1')
            ->withToken((string) config('services.groq.key'))
            ->acceptJson()
            ->timeout(30)
            ->post('/chat/completions', [
                'model' => config('services.groq.model'),
                'temperature' => 0.1,
                'response_format' => ['type' => 'json_object'],
                'messages' => array_merge(
                    [['role' => 'system', 'content' => $systemPrompt]],
                    $chatHistory,
                    [['role' => 'user', 'content' => json_encode(['game' => $game->name, 'catalog' => $catalog, 'request' => $message], JSON_UNESCAPED_UNICODE)]]
                ),
            ]);

        if ($response->failed()) {
            throw new \RuntimeException('Layanan AI tidak dapat memproses permintaan saat ini.');
        }

        $content = (string) data_get($response->json(), 'choices.0.message.content', '{}');
        $content = preg_replace('/^```(?:json)?\s*|\s*```$/', '', trim($content));
        $parsed = json_decode($content, true);
        if (! is_array($parsed)) {
            throw new \RuntimeException('Respons AI tidak dapat dibaca.');
        }

        $intent = in_array($parsed['intent'] ?? null, ['conversation', 'clarification', 'estimate'], true)
            ? $parsed['intent']
            : 'clarification';
        $isInventoryInput = $items->isNotEmpty()
            && $intent === 'estimate'
            && $this->looksLikeInventoryInput($message, $categories, $rarities);

        $matched = [];
        $matches = is_array($parsed['matches'] ?? null) ? $parsed['matches'] : [];
        foreach ($isInventoryInput ? $matches : [] as $match) {
            if (! is_array($match)) continue;
            $item = $items->firstWhere('id', $match['id'] ?? null);
            if (! $item) continue;
            $quantity = max(1, min(999, (int) ($match['quantity'] ?? 1)));
            $matched[] = [
                'tempId' => 'ai-'.$item->id.'-'.uniqid(), 'gameId' => $game->id,
                'categoryId' => $item->category_id, 'categoryName' => $categories->get($item->category_id)?->name ?? '-',
                'rarityId' => $item->rarity_id, 'rarityName' => $rarities->get($item->rarity_id)?->name ?? '-',
                'itemId' => $item->id, 'itemName' => $item->name, 'itemType' => $item->type,
                'quantity' => $quantity, 'unitCurrency' => (int) $item->estimated_currency,
                'totalCurrency' => (int) $item->estimated_currency * $quantity,
                'matchSource' => 'database', 'confidence' => 'high', 'originalRawText' => $message,
            ];
        }

        $unknownSource = $parsed['unknownItems'] ?? $parsed['unknown'] ?? [];
        $unknownSource = is_array($unknownSource) ? $unknownSource : [];
        $unknown = $isInventoryInput
            ? collect($unknownSource)
                ->map(fn ($item) => is_string($item) ? trim($item) : '')
                ->filter(fn ($item) => $item !== '')
                ->unique()
                ->take(10)
                ->values()
                ->all()
            : [];

        return ['message' => (string) ($parsed['message'] ?? 'Silakan tuliskan detail item akun yang ingin diestimasi.'), 'items' => $matched, 'unknown' => $unknown];
    }

    private function looksLikeInventoryInput(string $message, $categories, $rarities): bool
    {
        $normalized = mb_strtolower($message);
        $catalogTerms = $categories->pluck('name')
            ->merge($rarities->pluck('name'))
            ->filter(fn ($term) => mb_strlen(trim($term)) >= 3)
            ->map(fn ($term) => mb_strtolower(trim($term)));

        $matchedTerms = $catalogTerms
            ->filter(fn ($term) => str_contains($normalized, $term))
            ->count();

        $hasQuantity = (bool) preg_match('/\b\d+\s*(?:x|buah|item|skin|bundle|emote|pet|senjata|weapon)?\b/ui', $message);
        $hasInventoryWord = (bool) preg_match('/\b(item|skin|senjata|weapon|bundle|emote|pet|melee|pistol|rifle)\b/ui', $message);

        return $matchedTerms >= 2 || ($matchedTerms >= 1 && ($hasQuantity || $hasInventoryWord));
    }
}
