function encodeInp(input: string): string {
  return Buffer.from(input, "utf8").toString("base64");
}

export function buildEncodedCredential(account: string, password: string, scodeSeed: string, sxh: string): string {
  const accountEncoded = encodeInp(account);
  const passwordEncoded = encodeInp(password);
  const codeDogEncoded = encodeInp(" ");
  const code = `${accountEncoded}%%%${passwordEncoded}%%%${codeDogEncoded}`;

  let scode = scodeSeed;
  let encoded = "";

  for (let i = 0; i < code.length; i += 1) {
    if (i < 55) {
      const index = Number.parseInt(sxh.slice(i, i + 1), 10);
      const safeIndex = Number.isFinite(index) && index > 0 ? index : 0;
      encoded += `${code[i]}${scode.slice(0, safeIndex)}`;
      scode = scode.slice(safeIndex);
    } else {
      encoded += code.slice(i);
      break;
    }
  }

  return encoded;
}
