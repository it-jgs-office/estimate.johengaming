<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Game;
use App\Models\GameItem;
use App\Models\Rarity;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GroqEstimatorService
{
    public function estimate(Game $game, string $message, array $history = []): array
    {
        $items = GameItem::query()->where('game_id', $game->id)->where('status', 'active')->get();
        $categories = Category::query()->where('game_id', $game->id)->get()->keyBy('id');
        $rarities = Rarity::query()->where('game_id', $game->id)->get()->keyBy('id');

        $structuredResult = $this->matchStructuredInventory($game, $message, $items, $categories, $rarities);
        if ($structuredResult !== null) {
            return $structuredResult;
        }

        $catalogItems = $this->selectCatalogCandidates($items, $categories, $rarities, $message);
        $catalog = $catalogItems->map(fn (GameItem $item, int $index) => [
            'i' => $index + 1,
            'c' => $categories->get($item->category_id)?->name,
            'n' => $rarities->get($item->rarity_id)?->name,
        ])->values()->all();

        $systemPrompt = <<<'PROMPT'
Anda adalah Johen Price Estimator, asisten percakapan berbahasa Indonesia untuk estimasi akun game.

Tugas Anda memiliki tiga intent: "conversation" untuk obrolan, pertanyaan, judul, atau konteks singkat; "clarification" bila pengguna ingin estimasi tetapi datanya belum cukup; dan "estimate" hanya bila pengguna benar-benar memberi daftar/spesifikasi item akun.

Untuk conversation, jawab dengan ramah dan singkat. Anda boleh menjelaskan cara kerja estimator dan batasannya: harga hanya dihitung dari katalog game yang diberikan, Anda tidak boleh mengarang kategori, item, atau harga. Jangan mengeluarkan matches atau unknownItems untuk percakapan biasa, judul, salam, satu kata, atau kalimat yang bukan daftar item. Contoh "valoran kesatu", "akun saya", dan "halo" adalah conversation, BUKAN item yang perlu nilai manual.

Untuk clarification, jelaskan data apa yang dibutuhkan (kategori, item, atau jumlah) dan jangan mengeluarkan matches maupun unknownItems.

Pilih estimate hanya jika permintaan secara jelas menyebut koleksi/item akun. Cocokkan salah ketik, bahasa santai, singkatan, dan jumlah item ke katalog. Jangan mengarang kecocokan. unknownItems hanya boleh diisi untuk item akun yang konkret dan belum ada di katalog, bukan karena judul, nama akun, konteks, atau pesan ambigu. Jika ragu, pilih clarification dan unknownItems kosong. Gabungkan kecocokan item yang sama dengan menjumlahkan quantity.

Jika satu kategori diikuti beberapa nama yang dipisahkan koma, setiap nama adalah skin terpisah pada kategori tersebut. Contoh `VANDAL: REAVER, FORSAKEN` berarti Vandal Reaver + Vandal Forsaken, bukan satu item gabungan. Abaikan informasi non-skin seperti Agent, Rank, Peakrank, Premier, dan status akun.

Kenali `OP` sebagai kategori Operator. Pada format `KATEGORI: SKIN`, cocokkan setiap skin hanya ke kategori itu. Jika urutannya terbalik seperti `ONI: PHANTOM`, kenali Phantom sebagai kategori dan Oni sebagai skin. Jangan meminta konfirmasi jika pasangan kategori dan skin tersedia di katalog.

Katalog bisa kosong. Jika pengguna meminta estimasi saat katalog kosong, jelaskan bahwa data Excel perlu diimpor; tetapi tetap tanggapi percakapan biasa dengan normal dan jangan meminta nilai manual.

Gunakan nilai `i` dari katalog sebagai `id` pada matches. Jangan gunakan id lain.

Balas JSON valid saja dengan bentuk:
{"intent":"conversation|clarification|estimate","message":"balasan bahasa Indonesia","matches":[{"id":1,"quantity":1}],"unknownItems":["item akun konkret yang belum ada di katalog"]}
PROMPT;

        $chatHistory = collect($history)
            ->filter(fn ($entry) => in_array($entry['role'] ?? null, ['user', 'assistant'], true) && is_string($entry['content'] ?? null))
            ->map(fn ($entry) => ['role' => $entry['role'], 'content' => mb_strimwidth($entry['content'], 0, 800)])
            ->values()
            ->all();

        $payload = [
            'model' => config('services.groq.model'),
            'temperature' => 0.1,
            'response_format' => [
                    'type' => 'json_schema',
                    'json_schema' => [
                        'name' => 'estimation_response',
                        'strict' => true,
                        'schema' => [
                            'type' => 'object',
                            'properties' => [
                                'intent' => ['type' => 'string', 'enum' => ['conversation', 'clarification', 'estimate']],
                                'message' => ['type' => 'string'],
                                'matches' => [
                                    'type' => 'array',
                                    'items' => [
                                        'type' => 'object',
                                        'properties' => [
                                            'id' => ['type' => 'integer'],
                                            'quantity' => ['type' => 'integer'],
                                        ],
                                        'required' => ['id', 'quantity'],
                                        'additionalProperties' => false,
                                    ],
                                ],
                                'unknownItems' => ['type' => 'array', 'items' => ['type' => 'string']],
                            ],
                            'required' => ['intent', 'message', 'matches', 'unknownItems'],
                            'additionalProperties' => false,
                        ],
                    ],
                ],
            'messages' => array_merge(
                [['role' => 'system', 'content' => $systemPrompt]],
                $chatHistory,
                [['role' => 'user', 'content' => json_encode(['game' => $game->name, 'catalog' => $catalog, 'request' => $message], JSON_UNESCAPED_UNICODE)]]
            ),
        ];

        $client = Http::baseUrl('https://api.groq.com/openai/v1')
            ->withToken((string) config('services.groq.key'))
            ->acceptJson()
            ->timeout(30);
        $response = $client->post('/chat/completions', $payload);

        $providerMessage = trim((string) data_get($response->json(), 'error.message'));
        if ($response->status() === 400 && str_contains(mb_strtolower($providerMessage), 'validate json')) {
            unset($payload['response_format']);
            $payload['messages'][0]['content'] .= "\nKeluarkan tepat satu objek JSON tanpa markdown dan tanpa teks tambahan.";
            $response = $client->post('/chat/completions', $payload);
        }

        if ($response->failed()) {
            $providerMessage = trim((string) data_get($response->json(), 'error.message'));
            Log::warning('Groq estimate request failed', ['status' => $response->status(), 'message' => $providerMessage]);
            throw new \RuntimeException($providerMessage ?: 'Layanan AI tidak dapat memproses permintaan saat ini.');
        }

        $content = (string) data_get($response->json(), 'choices.0.message.content', '{}');
        $content = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', trim($content));
        $jsonStart = strpos($content, '{');
        $jsonEnd = strrpos($content, '}');
        if ($jsonStart !== false && $jsonEnd !== false && $jsonEnd >= $jsonStart) {
            $content = substr($content, $jsonStart, $jsonEnd - $jsonStart + 1);
        }
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
            $item = $catalogItems->get(((int) ($match['id'] ?? 0)) - 1);
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
        $hasStructuredInventory = (bool) preg_match('/^\s*[^\r\n:]{2,30}\s*:\s*.+$/mu', $message);

        return $hasStructuredInventory || $matchedTerms >= 2 || ($matchedTerms >= 1 && ($hasQuantity || $hasInventoryWord));
    }

    private function selectCatalogCandidates($items, $categories, $rarities, string $message)
    {
        $normalizedMessage = preg_replace(
            ['/\bop\b/ui', '/\brgx\s*11\b/ui'],
            ['operator', 'rgx 11z'],
            mb_strtolower($message)
        );
        $terms = collect(preg_split('/[^\pL\pN]+/u', $normalizedMessage))
            ->filter(fn ($term) => mb_strlen($term) >= 3)
            ->unique()
            ->values();

        $matches = $items->map(function (GameItem $item) use ($categories, $rarities, $terms) {
            $searchable = mb_strtolower(implode(' ', [
                $categories->get($item->category_id)?->name,
                $rarities->get($item->rarity_id)?->name,
                $item->name,
            ]));
            $score = $terms->filter(fn ($term) => str_contains($searchable, $term))->count();

            return ['item' => $item, 'score' => $score];
        })->filter(fn ($candidate) => $candidate['score'] > 0)
            ->sortByDesc('score')
            ->pluck('item');

        return ($matches->isNotEmpty() ? $matches : $items)->take(80)->values();
    }

    private function matchStructuredInventory(Game $game, string $message, $items, $categories, $rarities): ?array
    {
        if (! str_contains($message, ':')) return null;

        $categoryNames = $categories->mapWithKeys(fn (Category $category) => [
            $this->normalizeCatalogText($category->name) => $category->name,
        ]);
        $ignoredLabels = ['skin', 'agent', 'rank', 'peakrank', 'premier'];
        $matchedItems = collect();
        $unknown = collect();
        $parsedSkinCount = 0;

        foreach (preg_split('/\R/u', $message) as $line) {
            if (! str_contains($line, ':')) continue;
            [$left, $right] = array_map('trim', explode(':', $line, 2));
            $leftKey = $this->normalizeCatalogText($left);
            $rightKey = $this->normalizeCatalogText($right);
            if (in_array($leftKey, $ignoredLabels, true)) continue;

            $categoryName = null;
            $skinText = $right;
            if ($leftKey === 'op') $leftKey = 'operator';
            $isCollection = $leftKey === 'bp';
            if ($isCollection) {
                $categoryName = 'BP';
            } elseif ($categoryNames->has($leftKey)) {
                $categoryName = $categoryNames->get($leftKey);
            } elseif ($categoryNames->has($rightKey)) {
                $categoryName = $categoryNames->get($rightKey);
                $skinText = $left;
            } else {
                continue;
            }

            foreach (array_filter(array_map('trim', explode(',', $skinText))) as $skinName) {
                $parsedSkinCount++;
                $requestedCategory = $this->normalizeCatalogText($categoryName);
                $candidates = $items->filter(function (GameItem $item) use ($skinName, $requestedCategory, $isCollection, $categories, $rarities) {
                    $itemCategory = $this->normalizeCatalogText($categories->get($item->category_id)?->name ?? '');
                    $itemSkin = $rarities->get($item->rarity_id)?->name ?? '';
                    return ($isCollection || $itemCategory === $requestedCategory)
                        && $this->skinNameMatches($skinName, $itemSkin);
                });

                if (! $isCollection && $requestedCategory !== 'melee') {
                    $candidates = $candidates->take(1);
                }

                if ($candidates->isEmpty()) {
                    $unknown->push("{$categoryName}: {$skinName}");
                    continue;
                }

                foreach ($candidates as $item) {
                    $actualCategoryName = $categories->get($item->category_id)?->name ?? $categoryName;
                    $matchedItems->push([
                        'tempId' => 'direct-'.$item->id.'-'.uniqid(), 'gameId' => $game->id,
                        'categoryId' => $item->category_id, 'categoryName' => $actualCategoryName,
                        'rarityId' => $item->rarity_id, 'rarityName' => $rarities->get($item->rarity_id)?->name ?? $skinName,
                        'itemId' => $item->id, 'itemName' => "{$actualCategoryName} ".($rarities->get($item->rarity_id)?->name ?? $skinName), 'itemType' => $item->type,
                        'quantity' => 1, 'unitCurrency' => (int) $item->estimated_currency,
                        'totalCurrency' => (int) $item->estimated_currency,
                        'matchSource' => 'database', 'confidence' => 'high', 'originalRawText' => $line,
                    ]);
                }
            }
        }

        if ($parsedSkinCount === 0) return null;

        $count = $matchedItems->count();
        $unknownText = $unknown->unique()->values();
        $messageText = $count > 0
            ? "Berhasil mengenali {$count} item dari daftar terstruktur."
            : 'Tidak ada skin pada daftar yang cocok dengan katalog.';
        if ($unknownText->isNotEmpty()) {
            $messageText .= ' Tidak ditemukan pada kategori tersebut di Excel: '.$unknownText->implode(', ').'.';
        }

        return ['message' => $messageText, 'items' => $matchedItems->values()->all(), 'unknown' => $unknownText->all()];
    }

    private function skinNameMatches(string $requested, string $catalogName): bool
    {
        $requestedKey = $this->normalizeCatalogText($requested);
        $catalogKey = $this->normalizeCatalogText($catalogName);
        if ($requestedKey === '' || $catalogKey === '') return false;
        if (str_contains($catalogKey, $requestedKey) || str_contains($requestedKey, $catalogKey)) return true;

        return strlen($requestedKey) >= 5 && levenshtein($requestedKey, $catalogKey) <= 2;
    }

    private function normalizeCatalogText(string $value): string
    {
        $value = mb_strtolower(trim($value));
        $value = preg_replace('/\brgx\s*11(?:1|z)?\b/u', 'rgx11z', $value);
        return preg_replace('/[^\pL\pN]+/u', '', $value);
    }
}
