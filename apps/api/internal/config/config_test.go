package config

import (
	"strings"
	"testing"
)

func secureProdConfig() *Config {
	return &Config{
		AppEnv:               "production",
		JWTSecret:            strings.Repeat("j", 48),
		ChannelEncryptionKey: strings.Repeat("k", 48),
		WhatsAppAppSecret:    "wa-secret",
		MetaAppSecret:        "meta-secret",
		InboxDemoEcho:        false,
	}
}

func TestValidateAcceptsSecureProductionConfig(t *testing.T) {
	if err := secureProdConfig().Validate(); err != nil {
		t.Fatalf("Validate() = %v, want nil", err)
	}
}

func TestValidateRejectsInsecureProductionConfig(t *testing.T) {
	cases := map[string]func(*Config){
		"default jwt secret":      func(c *Config) { c.JWTSecret = defaultJWTSecret },
		"short jwt secret":        func(c *Config) { c.JWTSecret = "short" },
		"default encryption key":  func(c *Config) { c.ChannelEncryptionKey = defaultEncryptionKey },
		"missing whatsapp secret": func(c *Config) { c.WhatsAppAppSecret = "" },
		"missing meta secret":     func(c *Config) { c.MetaAppSecret = "" },
		"demo echo enabled":       func(c *Config) { c.InboxDemoEcho = true },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			cfg := secureProdConfig()
			mutate(cfg)
			if err := cfg.Validate(); err == nil {
				t.Fatal("Validate() = nil, want error")
			}
		})
	}
}

func TestValidateAllowsDevDefaults(t *testing.T) {
	cfg := &Config{
		AppEnv:               "development",
		JWTSecret:            defaultJWTSecret,
		ChannelEncryptionKey: defaultEncryptionKey,
		InboxDemoEcho:        true,
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("Validate() = %v, want nil in development", err)
	}
	cfg.JWTSecret = ""
	if err := cfg.Validate(); err == nil {
		t.Fatal("empty JWT secret accepted in development")
	}
}

func TestLoadDefaultsDependOnEnvironment(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("INBOX_DEMO_ECHO", "")
	t.Setenv("WEBHOOK_ALLOW_PRIVATE_TARGETS", "")
	cfg := Load()
	if cfg.InboxDemoEcho || cfg.WebhookAllowPrivateTargets {
		t.Fatalf("production defaults: demo echo=%v allow private=%v, want false/false",
			cfg.InboxDemoEcho, cfg.WebhookAllowPrivateTargets)
	}

	t.Setenv("APP_ENV", "development")
	cfg = Load()
	if !cfg.InboxDemoEcho || !cfg.WebhookAllowPrivateTargets {
		t.Fatalf("development defaults: demo echo=%v allow private=%v, want true/true",
			cfg.InboxDemoEcho, cfg.WebhookAllowPrivateTargets)
	}
}

func TestGetCIDRs(t *testing.T) {
	t.Setenv("TRUSTED_PROXIES", "173.245.48.0/20, 203.0.113.9 ,2400:cb00::/32, bogus")
	got := getCIDRs("TRUSTED_PROXIES")
	want := []string{"173.245.48.0/20", "203.0.113.9/32", "2400:cb00::/32"}
	if len(got) != len(want) {
		t.Fatalf("getCIDRs = %v, want %v", got, want)
	}
	for i, w := range want {
		if got[i].String() != w {
			t.Errorf("getCIDRs[%d] = %s, want %s", i, got[i], w)
		}
	}
}
