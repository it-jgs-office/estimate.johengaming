<?php

use App\Http\Controllers\Api\AiEstimatorController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CatalogController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('api.token')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/bootstrap', [CatalogController::class, 'bootstrap']);
    Route::post('/catalog/import', [CatalogController::class, 'import']);
    Route::post('/catalog/spreadsheet-sources', [CatalogController::class, 'connectSpreadsheet']);
    Route::delete('/catalog/games/{game}', [CatalogController::class, 'destroyGame']);
    Route::post('/catalog/items', [CatalogController::class, 'saveItem']);
    Route::delete('/catalog/items/{item}', [CatalogController::class, 'destroyItem']);
    Route::put('/catalog/pricing', [CatalogController::class, 'savePricing']);
    Route::post('/estimations', [CatalogController::class, 'saveEstimation']);
    Route::delete('/estimations/{estimation}', [CatalogController::class, 'destroyEstimation']);
    Route::post('/sessions', [CatalogController::class, 'storeSession']);
    Route::delete('/sessions/{session}', [CatalogController::class, 'destroySession']);
    Route::post('/ai/estimate', AiEstimatorController::class);
});
