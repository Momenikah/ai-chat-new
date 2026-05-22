// Package crypto provides authenticated encryption (AES-256-GCM) for
// secrets stored at rest — currently channel credentials.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"io"
)

// Encryptor performs AES-256-GCM encryption with a key derived from a
// configured secret.
type Encryptor struct {
	gcm cipher.AEAD
}

// NewEncryptor derives a 32-byte AES-256 key from the secret (SHA-256) so
// any non-empty secret string is accepted.
func NewEncryptor(secret string) (*Encryptor, error) {
	if secret == "" {
		return nil, errors.New("crypto: encryption secret must not be empty")
	}
	key := sha256.Sum256([]byte(secret))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Encryptor{gcm: gcm}, nil
}

// Encrypt seals plaintext and returns the ciphertext and the random nonce
// used. Both must be persisted to allow later decryption.
func (e *Encryptor) Encrypt(plaintext []byte) (ciphertext, nonce []byte, err error) {
	nonce = make([]byte, e.gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, err
	}
	ciphertext = e.gcm.Seal(nil, nonce, plaintext, nil)
	return ciphertext, nonce, nil
}

// Decrypt opens ciphertext sealed by Encrypt with the matching nonce.
func (e *Encryptor) Decrypt(ciphertext, nonce []byte) ([]byte, error) {
	if len(nonce) != e.gcm.NonceSize() {
		return nil, errors.New("crypto: invalid nonce length")
	}
	return e.gcm.Open(nil, nonce, ciphertext, nil)
}
