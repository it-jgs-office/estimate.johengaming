<?php

namespace App\Console\Commands;

use App\Models\SpreadsheetSource;
use App\Services\GoogleSpreadsheetCatalogSyncService;
use Illuminate\Console\Command;

class SyncGoogleSpreadsheetCatalogs extends Command
{
    protected $signature = 'catalog:sync-spreadsheets';
    protected $description = 'Synchronize active public Google Spreadsheet catalog sources';

    public function handle(GoogleSpreadsheetCatalogSyncService $syncService): int
    {
        SpreadsheetSource::query()->where('status', 'active')->each(function (SpreadsheetSource $source) use ($syncService) {
            try {
                $syncService->sync($source);
            } catch (\Throwable $error) {
                $this->error("Gagal sinkron {$source->source_url}: {$error->getMessage()}");
            }
        });

        return self::SUCCESS;
    }
}
