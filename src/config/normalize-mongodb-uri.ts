export function normalizeMongoDbUri(uri: string): string {
  try {
    const parsedUri = new URL(uri);
    const isLocalHost =
      parsedUri.hostname === 'localhost' || parsedUri.hostname === '127.0.0.1';
    const isSingleHost = !parsedUri.host.includes(',');

    if (
      parsedUri.protocol === 'mongodb:' &&
      isLocalHost &&
      isSingleHost &&
      !parsedUri.searchParams.has('replicaSet')
    ) {
      parsedUri.searchParams.set('replicaSet', 'rs0');
    }

    return parsedUri.toString();
  } catch {
    return uri;
  }
}
