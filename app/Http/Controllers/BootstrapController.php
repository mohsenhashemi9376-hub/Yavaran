<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Sync\DataExporter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class BootstrapController extends Controller
{
    public function __invoke(Request $request, DataExporter $exporter): Response
    {
        /** @var User|null $user */
        $user = $request->user();

        if ($user && ! $user->isActive()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            $user = null;
        }

        if (! $user) {
            return response()->json(['authenticated' => false]);
        }

        $originalId = (string) $request->session()->get('impersonator_id', $user->id);
        $canSwitch = $originalId === $user->id ? $user->isAdmin() : (bool) User::query()->whereKey($originalId)->where('role', 'admin')->exists();

        return response($exporter->json($user, $canSwitch), 200, [
            'Content-Type' => 'application/json; charset=utf-8',
        ]);
    }
}
