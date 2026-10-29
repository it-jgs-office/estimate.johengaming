<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Services\GroqEstimatorService;
use Illuminate\Http\Request;

class AiEstimatorController extends Controller
{
    public function __invoke(Request $request, GroqEstimatorService $estimator)
    {
        $data = $request->validate([
            'gameId' => ['required', 'uuid', 'exists:games,id'],
            'message' => ['required', 'string', 'max:4000'],
            'history' => ['nullable', 'array', 'max:8'],
            'history.*.role' => ['required_with:history', 'in:user,assistant'],
            'history.*.content' => ['required_with:history', 'string', 'max:4000'],
        ]);
        try {
            return response()->json($estimator->estimate(
                Game::query()->findOrFail($data['gameId']),
                $data['message'],
                $data['history'] ?? [],
            ));
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 503);
        }
    }
}
