<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('spreadsheet_sources', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('source_url')->unique();
            $table->string('game_name');
            $table->string('currency_name');
            $table->string('status')->default('active');
            $table->timestamp('last_synced_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('spreadsheet_sources');
    }
};
