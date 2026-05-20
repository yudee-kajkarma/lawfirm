// Pure-JS ObjectId-string validator. Safe to import on the client — never
// pull Mongoose's `isValidObjectId` into shared/validator code, that drags
// the whole driver (TLS, net, dns) into the client bundle.

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

export function isValidObjectIdString(id: unknown): id is string {
  return typeof id === 'string' && OBJECT_ID_RE.test(id);
}
