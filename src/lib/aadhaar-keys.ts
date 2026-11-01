// UIDAI's public keys for checking the digital signature on the Secure QR code of an Aadhaar
// (letter, PVC card, e-Aadhaar, Aadhaar app). Only public keys: they can check a signature,
// never make one. UIDAI publishes the certificates on its "Data and Downloads" page as the
// "Paperless Offline e-KYC" certificates; a QR made while a key was in use keeps verifying with
// it after the certificate's end date, so old keys stay in this list.
//
// Each key is the SubjectPublicKeyInfo (base64 DER) of the certificate named, with the
// certificate's SHA-256 fingerprint so it can be compared with UIDAI's file.
// To add a key: openssl x509 -in <file>.cer -pubkey -noout | openssl pkey -pubin -outform DER | base64 -w0

export interface UidaiKey {
  name: string;
  validFrom: string;
  validTo: string;
  certSha256: string;
  spki: string;
}

export const UIDAI_KEYS: UidaiKey[] = [
  {
    name: "uidai_offline_publickey_2026",
    validFrom: "2026-02-03",
    validTo: "2029-02-03",
    certSha256: "E0:30:4B:9E:61:EE:36:40:EC:DD:AE:2D:B4:B6:17:F2:E2:67:8F:57:DB:C2:82:6C:2F:86:AC:5C:04:F2:77:DF",
    spki: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAh1+zYnvbcEm0Yz73s5u42odpUJMr9wv5bVw7sOE5nFNbrB+U++5I0f8cL2HoHnJOkwvLZzrD0jG/vxAKi6vii/gjEzUEgrkdIHxMP3D6GJs0MSQHiEXvIGOwPIH3BLtBOc3m28NVNT6Q9iq0gUwuxnlhV38UdNhCllqNYhWmAMPJkImgaKrRZvY2pWNs6gd+PlAF/9SO69x3+1meA8kPk2ZvQanZlx9tfaExeOe9or3NQiKy2+UbtXrpcoAfYbbWi1OUzXi5bJdhbGp239c1fX6UKyUM5IUMY+m3I7wu2WQ7lmeO2n/vwzQz/PKHXPWYu3bydWMLdCi07vOQBqzCKwIDAQAB",
  },
  {
    name: "uidai_offline_publickey_17022026",
    validFrom: "2024-02-21",
    validTo: "2026-02-16",
    certSha256: "00:57:3C:69:2C:F0:4F:BE:E1:13:AE:5F:D5:2F:2A:65:4D:36:1B:F8:EE:4D:06:C4:60:08:90:6B:36:DF:81:69",
    spki: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmMIJKj28JcTN1B72p2/pgzDCoguhs/rbIXgN/ybNNh0NVOrZV2KllrmT5VOYlMrABpvIp7JU/n6hma3/O14n7nvngJ/y3colh8rk7msDwVAO7ZuVD+GCzfaYPLLkUS+wqH7M7FOHIn/pyJo1Rkxm98lO3dyox5RuLG2Uqm7JfVIomm0t7QKJoM5rf8JNvPXdwsxN89eWlT2Bf7BF//G3FKiF7ZHfvIyyqte/3orRRG/M80QqLrDP1RIeOa53ZTgILXcyQOb2yZOqNH3iN2uSKRsusNO17To5FOb2J9Hd5wIMuDv3zw4MWTrKAWuTYon90QSeGRKv1d5AQNRt0x5dSwIDAQAB",
  },
  {
    name: "uidai_offline_publickey_26022021",
    validFrom: "2021-02-26",
    validTo: "2024-02-27",
    certSha256: "E0:F0:F8:69:D3:2E:FC:7E:80:FA:E2:22:37:17:A5:6D:CF:8B:61:6F:82:0B:54:2A:49:E5:BD:5A:BF:1C:0F:7D",
    spki: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAonIsDl8t5bpwftk/A27CsfC5VZMjkPrMDwvL8gyAoVwIi0iGhmty6yWrC/VaL+Brae29XMg7dMdwnbIUHmwHxovN+FnT2vfz/O0kHQcgVdwVSIR0tFwsmC+pVKpSqm//skgYYcZQhdhLZBWOn0PZ81ymm0jOkwBSIQKkyuCTv/1HSwjTLR0EBvaH9+Vb0iaiOEv1ikHDhMOXTxx8URWBnJJt463z7LuZBMSG8fXVMDl3vqY1hDZzKbXBaK/clRIXMff0jUOvfPMfabHju+eUnceosQwL3eurq96+oHahz4FmrfBqikHe3xQ7/4NdvSvVuwth0kcsI0ptRBG8m1NglQIDAQAB",
  },
];
