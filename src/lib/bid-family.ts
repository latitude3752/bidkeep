/** The whole Bid* portfolio, all products of Fountain City Capital, LLC.
 * Each sibling site's brand name is contested in search by unrelated,
 * more established products (an AI RFP tool for "BidHawk," a spelling
 * autocorrect to "Vidyard" for "BidYard," several unrelated apps for
 * "BidPulse"). Cross-linking the family gives search engines a real,
 * reciprocal signal that these four sites are a legitimate, connected
 * product family rather than four isolated pages easily overwhelmed by
 * an unrelated same-named competitor. */
export const BID_FAMILY = [
  { name: "BidHawk", host: "trybidhawk.com", url: "https://trybidhawk.com", vertical: "UAS & counter-UAS" },
  { name: "BidYard", host: "trybidyard.com", url: "https://trybidyard.com", vertical: "construction" },
  { name: "BidPulse", host: "trybidpulse.com", url: "https://trybidpulse.com", vertical: "medical & healthcare" },
  { name: "BidKeep", host: "trybidkeep.com", url: "https://trybidkeep.com", vertical: "facilities" },
] as const;
