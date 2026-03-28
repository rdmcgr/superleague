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
  ENG: "GB", // England uses Union flag for emoji
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
  SCO: "GB", // Scotland uses Union flag for emoji
  SEN: "SN",
  SUI: "CH",
  SUR: "SR",
  TUN: "TN",
  URU: "UY",
  USA: "US",
  UZB: "UZ"
};

function iso2ToFlag(iso2: string) {
  if (iso2.length !== 2) return "";
  const base = 0x1f1e6;
  const chars = iso2.toUpperCase().split("");
  return String.fromCodePoint(base + (chars[0].charCodeAt(0) - 65), base + (chars[1].charCodeAt(0) - 65));
}

export function flagForCode(code: string) {
  const iso2 = codeToIso2[code];
  return iso2 ? iso2ToFlag(iso2) : "";
}
