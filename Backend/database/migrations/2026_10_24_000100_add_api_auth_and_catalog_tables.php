<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('STAFF');
            $table->string('api_token', 80)->nullable()->unique();
        });

        Schema::create('games', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('icon')->default('Gamepad2');
            $table->string('currency_name');
            $table->string('currency_symbol');
            $table->decimal('default_conversion_rate', 14, 2)->default(0);
            $table->decimal('low_percentage', 5, 2)->default(0);
            $table->decimal('medium_percentage', 5, 2)->default(0);
            $table->decimal('high_percentage', 5, 2)->default(0);
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_id')->constrained('games')->cascadeOnDelete();
            $table->string('name');
            $table->json('aliases')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
            $table->unique(['game_id', 'name']);
        });

        Schema::create('rarities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_id')->constrained('games')->cascadeOnDelete();
            $table->string('name');
            $table->json('aliases')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
            $table->unique(['game_id', 'name']);
        });

        Schema::create('game_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_id')->constrained('games')->cascadeOnDelete();
            $table->foreignUuid('category_id')->constrained('categories')->cascadeOnDelete();
            $table->foreignUuid('rarity_id')->constrained('rarities')->cascadeOnDelete();
            $table->string('name');
            $table->string('type')->default('standard');
            $table->unsignedBigInteger('estimated_currency');
            $table->string('status')->default('active');
            $table->timestamps();
            $table->unique(['game_id', 'category_id', 'rarity_id']);
        });

        Schema::create('pricing_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_id')->unique()->constrained('games')->cascadeOnDelete();
            $table->decimal('currency_rate', 14, 2)->default(0);
            $table->decimal('low_percentage', 5, 2)->default(0);
            $table->decimal('medium_percentage', 5, 2)->default(0);
            $table->decimal('high_percentage', 5, 2)->default(0);
            $table->string('rounding_mode')->default('none');
            $table->string('default_tier')->default('medium');
            $table->timestamps();
        });

        Schema::create('estimations', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('game_id')->constrained('games')->cascadeOnDelete();
            $table->string('title');
            $table->string('account_identifier')->nullable();
            $table->text('original_specification');
            $table->unsignedBigInteger('total_currency');
            $table->decimal('conversion_rate_snapshot', 14, 2);
            $table->decimal('low_percentage_snapshot', 5, 2);
            $table->decimal('medium_percentage_snapshot', 5, 2);
            $table->decimal('high_percentage_snapshot', 5, 2);
            $table->unsignedBigInteger('base_value');
            $table->unsignedBigInteger('low_price');
            $table->unsignedBigInteger('medium_price');
            $table->unsignedBigInteger('high_price');
            $table->text('notes')->nullable();
            $table->json('items_snapshot');
            $table->timestamps();
        });

        Schema::create('estimation_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('game_id')->constrained('games')->cascadeOnDelete();
            $table->string('title');
            $table->json('messages');
            $table->json('current_items');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('estimation_sessions');
        Schema::dropIfExists('estimations');
        Schema::dropIfExists('pricing_settings');
        Schema::dropIfExists('game_items');
        Schema::dropIfExists('rarities');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('games');
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['api_token']);
            $table->dropColumn(['role', 'api_token']);
        });
    }
};
