<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        $user = $token ? User::query()->where('api_token', $token)->first() : null;

        if (! $user) {
            return response()->json(['message' => 'Sesi tidak valid atau sudah berakhir.'], 401);
        }

        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
