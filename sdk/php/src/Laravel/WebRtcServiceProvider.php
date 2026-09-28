<?php

namespace WebRTC\Client\Laravel;

use Illuminate\Support\ServiceProvider;
use WebRTC\Client\WebRtcClient;
use NexusRTC\Client\NexusRtcClient;

class WebRtcServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        if (file_exists(__DIR__ . '/config/webrtc.php')) {
            $this->mergeConfigFrom(__DIR__ . '/config/webrtc.php', 'webrtc');
        }
        if (file_exists(__DIR__ . '/config/nexusrtc.php')) {
            $this->mergeConfigFrom(__DIR__ . '/config/nexusrtc.php', 'nexusrtc');
        }

        $this->app->singleton(WebRtcClient::class, function ($app) {
            $config = $app['config']['webrtc'] ?? $app['config']['nexusrtc'] ?? [];
            return new WebRtcClient(
                baseUrl: $config['base_url'] ?? 'http://127.0.0.1:4000',
                apiKey: $config['api_key'] ?? '',
                timeout: $config['timeout'] ?? 10
            );
        });

        $this->app->alias(WebRtcClient::class, 'webrtc');
        $this->app->alias(WebRtcClient::class, NexusRtcClient::class);
        $this->app->alias(WebRtcClient::class, 'nexusrtc');
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__ . '/config/webrtc.php' => $this->app->configPath('webrtc.php'),
            ], 'webrtc-config');

            $this->publishes([
                __DIR__ . '/config/nexusrtc.php' => $this->app->configPath('nexusrtc.php'),
            ], 'nexusrtc-config');
        }
    }
}

