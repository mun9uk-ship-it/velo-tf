/**
 * Velo Tf — starter recipes.
 * Each recipe seeds a list of resources + field overrides.
 */
const RECIPES = {
  "random-password-vault": {
    label: "Random password vault",
    resources: [
      { id: "random_password", fields: { name: "vault_pw", length: 24 } },
      { id: "local_file",      fields: { name: "vault_file", filename: "${path.module}/vault.txt", content: "password stored here" } }
    ]
  },
  "docker-nginx": {
    label: "Docker nginx",
    resources: [
      { id: "docker_container", fields: { name: "web", image: "nginx:latest", ports: 8080 } }
    ]
  },
  "local-config-files": {
    label: "Local config files",
    resources: [
      { id: "local_file", fields: { name: "app_config", filename: "${path.module}/app.conf", content: "listen = 8080" } },
      { id: "local_file", fields: { name: "env_config", filename: "${path.module}/.env",      content: "DEBUG=true" } }
    ]
  },
  "tls-cert-lab": {
    label: "TLS certificate lab",
    resources: [
      { id: "tls_private_key", fields: { name: "lab_key", algorithm: "RSA", rsa_bits: 2048 } },
      { id: "local_file",      fields: { name: "key_file", filename: "${path.module}/key.pem", content: "private key goes here" } }
    ]
  }
};