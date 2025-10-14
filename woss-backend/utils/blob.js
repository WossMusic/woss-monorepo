const { BlobServiceClient } = require("@azure/storage-blob");
const client = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
const container = client.getContainerClient(process.env.AZURE_STORAGE_CONTAINER);

async function uploadBuffer(name, buffer, contentType) {
  const blob = container.getBlockBlobClient(name);
  await blob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });
  return blob.url; // public if container is public; else generate SAS
}

module.exports = { uploadBuffer };
