/**
 * Velo Tf — single source of truth for every Terraform resource we can generate.
 * Adding a new resource = add one entry here (and optionally a recipe).
 *
 * Entry shape:
 *  - id: stable key
 *  - label: chip label
 *  - desc: short human description (Explain mode + README)
 *  - provider: terraform provider name
 *  - fields: form fields
 *  - hcl: (ctx) => string of HCL body
 *  - explain: (line) => per-line explanation or null
 */
const RESOURCES = {
  random_password: {
    id: "random_password",
    label: "Random password",
    desc: "Generates a random password string.",
    provider: "random",
    fields: [
      { name: "name", label: "Resource name", type: "text", default: "db_password" },
      { name: "length", label: "Length", type: "number", default: 16 },
      { name: "special", label: "Include special chars", type: "select", options: ["true", "false"], default: "true" }
    ],
    hcl: (c) => [
      `resource "random_password" "${c.name}" {`,
      `  length  = ${c.length}`,
      `  special = ${c.special}`,
      `}`
    ].join("\n"),
    explain: (line) => {
      if (line.includes("resource")) return "Declares a random_password resource managed by Terraform.";
      if (line.includes("length"))   return "Sets how many characters the password should contain.";
      if (line.includes("special"))  return "Whether to include symbols like !@#$.";
      return null;
    }
  },

  local_file: {
    id: "local_file",
    label: "Local file",
    desc: "Writes a file to disk on the machine running Terraform.",
    provider: "local",
    fields: [
      { name: "name", label: "Resource name", type: "text", default: "config" },
      { name: "filename", label: "File path", type: "text", default: "${path.module}/output.txt" },
      { name: "content", label: "Content", type: "text", default: "hello from Velo Tf" }
    ],
    hcl: (c) => [
      `resource "local_file" "${c.name}" {`,
      `  filename = "${c.filename}"`,
      `  content  = "${c.content}"`,
      `}`
    ].join("\n"),
    explain: (line) => {
      if (line.includes("resource")) return "Declares a local_file resource.";
      if (line.includes("filename")) return "The path on disk where the file will be written.";
      if (line.includes("content"))  return "The text written into the file.";
      return null;
    }
  },

  null_resource: {
    id: "null_resource",
    label: "Null resource",
    desc: "A resource that does nothing by itself, useful as a trigger.",
    provider: "null",
    fields: [
      { name: "name", label: "Resource name", type: "text", default: "trigger" }
    ],
    hcl: (c) => [
      `resource "null_resource" "${c.name}" {`,
      `  triggers = {`,
      `    always = timestamp()`,
      `  }`,
      `}`
    ].join("\n"),
    explain: (line) => {
      if (line.includes("resource"))  return "Declares a null_resource, often used to run provisioners.";
      if (line.includes("triggers"))  return "A map of values; changing them forces re-creation.";
      if (line.includes("timestamp")) return "Changes every apply, so the resource is re-created.";
      return null;
    }
  },

  time_static: {
    id: "time_static",
    label: "Time stamp",
    desc: "Records the current timestamp once and keeps it.",
    provider: "time",
    fields: [
      { name: "name", label: "Resource name", type: "text", default: "created_at" }
    ],
    hcl: (c) => [
      `resource "time_static" "${c.name}" {}`
    ].join("\n"),
    explain: (line) => {
      if (line.includes("resource")) return "Records a timestamp the first time it is applied.";
      return null;
    }
  },

  tls_private_key: {
    id: "tls_private_key",
    label: "TLS private key",
    desc: "Generates a PEM-encoded private key for learning TLS.",
    provider: "tls",
    fields: [
      { name: "name", label: "Resource name", type: "text", default: "key" },
      { name: "algorithm", label: "Algorithm", type: "select", options: ["RSA", "ECDSA"], default: "RSA" },
      { name: "rsa_bits", label: "RSA bits", type: "number", default: 2048 }
    ],
    hcl: (c) => {
      const lines = [
        `resource "tls_private_key" "${c.name}" {`,
        `  algorithm = "${c.algorithm}"`
      ];
      if (c.algorithm === "RSA") lines.push(`  rsa_bits  = ${c.rsa_bits}`);
      lines.push(`}`);
      return lines.join("\n");
    },
    explain: (line) => {
      if (line.includes("resource"))  return "Generates a private key managed by Terraform.";
      if (line.includes("algorithm")) return "RSA is the classic choice; ECDSA is smaller and faster.";
      if (line.includes("rsa_bits"))  return "Key size in bits. 2048 is the common minimum.";
      return null;
    }
  },

  docker_container: {
    id: "docker_container",
    label: "Docker container",
    desc: "Runs a container on your local Docker daemon.",
    provider: "docker",
    fields: [
      { name: "name", label: "Container name", type: "text", default: "nginx" },
      { name: "image", label: "Image", type: "text", default: "nginx:latest" },
      { name: "ports", label: "Host port", type: "number", default: 8080 }
    ],
    hcl: (c) => [
      `resource "docker_container" "${c.name}" {`,
      `  name  = "${c.name}"`,
      `  image = "${c.image}"`,
      `  ports {`,
      `    internal = 80`,
      `    external = ${c.ports}`,
      `  }`,
      `}`
    ].join("\n"),
    explain: (line) => {
      if (line.includes("resource"))  return "Runs a Docker container.";
      if (line.includes("image"))     return "The Docker image to pull and run.";
      if (line.includes("internal"))  return "Port inside the container.";
      if (line.includes("external"))  return "Port published on your host machine.";
      return null;
    }
  }
};