package crypto

import (
	"bytes"
	"testing"
)

func TestEncryptDecryptRoundTrip(t *testing.T) {
	enc, err := NewEncryptor("secret")
	if err != nil {
		t.Fatal(err)
	}
	plain := []byte(`{"access_token":"EAAG..."}`)
	ct, nonce, err := enc.Encrypt(plain)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(ct, plain) {
		t.Fatal("ciphertext contains plaintext")
	}
	got, err := enc.Decrypt(ct, nonce)
	if err != nil || !bytes.Equal(got, plain) {
		t.Fatalf("Decrypt = %q, %v", got, err)
	}

	other, _ := NewEncryptor("different")
	if _, err := other.Decrypt(ct, nonce); err == nil {
		t.Fatal("decrypted with the wrong key")
	}
	ct[0] ^= 0xff
	if _, err := enc.Decrypt(ct, nonce); err == nil {
		t.Fatal("tampered ciphertext accepted")
	}
	if _, err := NewEncryptor(""); err == nil {
		t.Fatal("empty secret accepted")
	}
}
