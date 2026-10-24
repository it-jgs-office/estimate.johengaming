<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);
        $user = User::query()->where('email', strtolower($data['email']))->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Email atau kata sandi tidak valid.'], 422);
        }

        $user->forceFill(['api_token' => Str::random(64)])->save();

        return response()->json(['token' => $user->api_token, 'user' => $this->user($user)]);
    }

    public function me(Request $request)
    {
        return response()->json(['user' => $this->user($request->user())]);
    }

    public function logout(Request $request)
    {
        $request->user()->forceFill(['api_token' => null])->save();

        return response()->noContent();
    }

    private function user(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'status' => 'active',
            'createdAt' => $user->created_at?->toISOString(),
        ];
    }
}
