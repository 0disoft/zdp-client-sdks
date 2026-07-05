# Upload Client Checklist

- Signed upload request shape stays explicit.
- Error mapping keeps request id and trace id.
- Idempotency propagation is preserved.
- Raw provider URL, bucket name, and file ownership decision are not public SDK contracts.
- Provider secret, signed URL, or real customer file metadata never appears in fixtures or docs.
