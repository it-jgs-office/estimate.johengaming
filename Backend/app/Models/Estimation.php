<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Estimation extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];
    protected function casts(): array { return ['items_snapshot' => 'array']; }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
