const codeToIso2: Record<string, string> = {
  ARG: "AR",
  AUS: "AU",
  AUT: "AT",
  BEL: "BE",
  BOL: "BO",
  BRA: "BR",
  ALG: "DZ",
  CAN: "CA",
  CIV: "CI",
  COD: "CD",
  COL: "CO",
  CPV: "CV",
  CRO: "HR",
  CUW: "CW",
  ECU: "EC",
  EGY: "EG",
  ESP: "ES",
  FRA: "FR",
  GER: "DE",
  GHA: "GH",
  HAI: "HT",
  IRN: "IR",
  IRQ: "IQ",
  JAM: "JM",
  JOR: "JO",
  JPN: "JP",
  KOR: "KR",
  KSA: "SA",
  MAR: "MA",
  MEX: "MX",
  NCL: "NC",
  NED: "NL",
  NOR: "NO",
  NZL: "NZ",
  PAN: "PA",
  PAR: "PY",
  POR: "PT",
  QAT: "QA",
  RSA: "ZA",
  SEN: "SN",
  SUI: "CH",
  SUR: "SR",
  TUN: "TN",
  URU: "UY",
  USA: "US",
  UZB: "UZ"
};

const specialFlags: Record<string, string> = {
  ENG: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  SCO: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}"
};

function iso2ToFlag(iso2: string) {
  if (iso2.length !== 2) return "";
  const base = 0x1f1e6;
  const chars = iso2.toUpperCase().split("");
  return String.fromCodePoint(base + (chars[0].charCodeAt(0) - 65), base + (chars[1].charCodeAt(0) - 65));
}

export function flagForCode(code: string) {
  const special = specialFlags[code];
  if (special) return special;
  const iso2 = codeToIso2[code];
  return iso2 ? iso2ToFlag(iso2) : "";
}
