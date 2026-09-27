<?php

namespace NexusRTC\Client\Laravel;

use Illuminate\Support\ServiceProvider;
use NexusRTC\Client\NexusRtcClient;

class NexusRtcServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/config/nexusrtc.php', 'nexusrtc');

        $this->app->singleton(NexusRtcClient::class, function ($app) {
            $config = $app['config']['nexusrtc'];
            return new NexusRtcClient(
                baseUrl: $config['base_url'] ?? 'http://127.0.0.1:4000',
                apiKey: $config['api_key'] ?? '',
                timeout: $config['timeout'] ?? 10
            );
        });

        $this->app->alias(NexusRtcClient::class, 'nexusrtc');
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__ . '/config/nexusrtc.php' => $this->app->configPath('nexusrtc.php'),
            ], 'nexusrtc-config');
        }
    }
}
