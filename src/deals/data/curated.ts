import type { CuratedDeal } from "../types";

/**
 * Weekday food specials that someone has read on the venue's or chain's own
 * website and typed in here. This is the instant, free half of the Daily Deals
 * page; the web search button covers everything else.
 *
 * Rules for adding to it:
 * - The source page itself must state the weekday. Roundups and aggregators are
 *   fine for finding a lead, never as the source.
 * - Food deals tied to a day of the week only. No every-day happy hours, no
 *   limited-time promotions, no app-only coupons.
 * - Write the price and conditions as the page gives them, in your own words.
 *   Leave out what the page does not say instead of guessing.
 * - Set `verified` to the day you read the page. Cards older than 90 days are
 *   marked as possibly out of date, so re-read the page and bump the date.
 * - If the source gives an end date, set `until` (YYYY-MM-DD). The deal hides
 *   itself the day after, so a promotion that lapses never lingers.
 *
 * To pin a deal to one venue, use `kind: "place"` with its OpenStreetMap ID and
 * coordinates (look it up at openstreetmap.org). For a chain, use `kind: "brand"`;
 * the Wikidata ID in the brand:wikidata tag of any branch is the surest match,
 * and the names are the fallback.
 */

const CHECKED = "2026-10-16";

export const CURATED_DEALS: CuratedDeal[] = [
  /* Wild Wing — Ontario wing chain */
  {
    id: "wild-wing-tuesday-single-orders",
    title: "$12 single orders",
    details:
      "A single order of wings (traditional, classic or boneless) with fries and a dip for $12 plus tax. Celery and carrots are $0.75 extra.",
    days: ["tue"],
    price: "$12",
    conditions: "Dine-in only, with any beverage purchase. At participating restaurants.",
    sourceUrl: "https://www.wildwingrestaurants.com/specials/",
    verified: CHECKED,
    match: { kind: "brand", names: ["Wild Wing"], wikidata: ["Q8000869"], countries: ["CA"] },
  },

  /* Kelseys Original Roadhouse */
  {
    id: "kelseys-monday-burgers",
    title: "Monday burger deal",
    details: "Burgers from $12, Mondays only.",
    days: ["mon"],
    price: "From $12",
    sourceUrl: "https://www.kelseys.ca/en/specials.html",
    verified: CHECKED,
    match: { kind: "brand", names: ["Kelseys Original Roadhouse", "Kelseys"], countries: ["CA"] },
  },
  {
    id: "kelseys-tuesday-kids-eat-free",
    title: "Kids eat free",
    details:
      "One free kids' meal with each adult entrée of $18.99 or more, plus a $2 donation to BGC (Boys & Girls Clubs).",
    days: ["tue"],
    conditions: "For kids 12 and under; not valid for groups of 8 or more kids.",
    sourceUrl: "https://www.kelseys.ca/en/specials.html",
    verified: CHECKED,
    match: { kind: "brand", names: ["Kelseys Original Roadhouse", "Kelseys"], countries: ["CA"] },
  },
  {
    id: "kelseys-thursday-half-price-wings",
    title: "Half-price wings and bites",
    details: "10 or 15 pieces of wings and bites at half price on Thursdays.",
    days: ["thu"],
    price: "Half price",
    conditions:
      "Dine-in only, with a beverage purchase. Participating restaurants only; cannot be combined with other offers.",
    sourceUrl: "https://www.kelseys.ca/en/specials.html",
    verified: CHECKED,
    match: { kind: "brand", names: ["Kelseys Original Roadhouse", "Kelseys"], countries: ["CA"] },
  },

  /* Montana's BBQ & Bar */
  {
    id: "montanas-monday-half-price-wings",
    title: "Half-price wings",
    details: "An 8-piece order of wings at half price every Monday.",
    days: ["mon"],
    price: "Half price",
    conditions:
      "Dine-in, with the purchase of any beverage. At participating restaurants, while supplies last; taxes extra.",
    sourceUrl: "https://www.montanas.ca/",
    verified: CHECKED,
    match: { kind: "brand", names: ["Montana's BBQ & Bar", "Montana's"], countries: ["CA"] },
  },
  {
    id: "montanas-tuesday-tacos",
    title: "Taco Tuesday",
    details: "Tacos are $5 each every Tuesday.",
    days: ["tue"],
    price: "$5",
    conditions:
      "Dine-in, with the purchase of any beverage. At participating restaurants, while supplies last; taxes extra.",
    sourceUrl: "https://www.montanas.ca/",
    verified: CHECKED,
    match: { kind: "brand", names: ["Montana's BBQ & Bar", "Montana's"], countries: ["CA"] },
  },
  {
    id: "montanas-wednesday-ribs",
    title: "All-you-can-eat ribs",
    details: "All-you-can-eat ribs every Wednesday. The site does not list a price, so ask before you go.",
    days: ["wed"],
    conditions: "Dine-in. At participating restaurants, while supplies last; taxes extra.",
    sourceUrl: "https://www.montanas.ca/",
    verified: CHECKED,
    match: { kind: "brand", names: ["Montana's BBQ & Bar", "Montana's"], countries: ["CA"] },
  },
  {
    id: "montanas-thursday-platter",
    title: "Pick your platter",
    details: "Pick your platter for $25.99 every Thursday, which the site says saves over 15%.",
    days: ["thu"],
    price: "$25.99",
    conditions: "Dine-in. At participating restaurants, while supplies last; taxes extra.",
    sourceUrl: "https://www.montanas.ca/",
    verified: CHECKED,
    match: { kind: "brand", names: ["Montana's BBQ & Bar", "Montana's"], countries: ["CA"] },
  },

  /* East Side Mario's */
  {
    id: "east-side-marios-monday-all-you-can-eat-pasta",
    title: "All-you-can-eat pasta",
    details: "All-you-can-eat pasta for $19.99 on Mondays.",
    days: ["mon"],
    price: "$19.99",
    conditions: "With the purchase of any beverage. The restaurant's site gives no list of participating locations.",
    sourceUrl: "https://www.eastsidemarios.com/en/daily-deals.html",
    verified: CHECKED,
    match: { kind: "brand", names: ["East Side Mario's"], countries: ["CA"] },
  },
  {
    id: "east-side-marios-tuesday-kids-eat-free",
    title: "Kids eat free",
    details: "Kids 10 and under eat free with each adult entrée of $19.99 or more on Tuesdays.",
    days: ["tue"],
    conditions: "The site gives no list of participating locations; check with the restaurant.",
    sourceUrl: "https://www.eastsidemarios.com/en/daily-deals.html",
    verified: CHECKED,
    match: { kind: "brand", names: ["East Side Mario's"], countries: ["CA"] },
  },
  {
    id: "east-side-marios-wednesday-pasta-or-pizza",
    title: "$15.99 pasta or pizza",
    details: "Pasta with your choice of sauce, or an individual cheese pizza, for $15.99 on Wednesdays.",
    days: ["wed"],
    price: "$15.99",
    conditions: "With the purchase of a beverage. The site gives no list of participating locations.",
    sourceUrl: "https://www.eastsidemarios.com/en/daily-deals.html",
    verified: CHECKED,
    match: { kind: "brand", names: ["East Side Mario's"], countries: ["CA"] },
  },
  {
    id: "east-side-marios-thursday-meal-for-two",
    title: "Three-course meal for two",
    details: "A three-course Italian meal for two for $50 on Thursdays.",
    days: ["thu"],
    price: "$50",
    conditions: "With the purchase of two beverages. The site gives no list of participating locations.",
    sourceUrl: "https://www.eastsidemarios.com/en/daily-deals.html",
    verified: CHECKED,
    match: { kind: "brand", names: ["East Side Mario's"], countries: ["CA"] },
  },

  /* St. Louis Bar & Grill */
  {
    id: "st-louis-tuesday-half-price-wings",
    title: "Half-price wings",
    details:
      "Half price on 1 or 2 lb of original or dusted wings, or 8 or 16 pieces of boneless or plant-based wings, every Tuesday.",
    days: ["tue"],
    hours: "5 pm to close",
    price: "Half price",
    conditions:
      "Dine-in only, with any regularly priced beverage. At participating locations; cannot be combined with other offers.",
    sourceUrl: "https://www.stlouiswings.com/halfpricewings/",
    verified: CHECKED,
    match: { kind: "brand", names: ["St. Louis Bar & Grill", "St. Louis Wings"], countries: ["CA"] },
  },

  /* Chuck's Roadhouse */
  {
    id: "chucks-roadhouse-wednesday-rib-day",
    title: "Rib Day Wednesday",
    details:
      "A ribs special every Wednesday. The restaurant's site does not say what is included or what it costs, so ask before you go.",
    days: ["wed"],
    conditions: "Dine-in only, with a beverage purchase; cannot be combined with other offers.",
    sourceUrl: "https://chucksroadhouse.com/offers/",
    verified: CHECKED,
    match: { kind: "brand", names: ["Chuck's Roadhouse Bar & Grill", "Chuck's Roadhouse"], countries: ["CA"] },
  },

  /* Boston Pizza */
  {
    id: "boston-pizza-weekday-lunch",
    title: "$15 lunch",
    details:
      "A main, a side and a drink for $15, ready in 20 minutes or your next lunch is on them. Mains include salads, sandwiches, pizzas and pastas.",
    days: ["mon", "tue", "wed", "thu", "fri"],
    hours: "11 am to 3 pm",
    price: "$15",
    conditions:
      "The 20-minute guarantee does not apply to takeout or delivery. Lunch hours may vary by restaurant.",
    sourceUrl: "https://bostonpizza.com/en/promotions/lunch-menu.html",
    verified: CHECKED,
    match: { kind: "brand", names: ["Boston Pizza"], countries: ["CA"] },
  },

  /* Swiss Chalet. Its daily deals page says all three run until 2026-10-31, at select locations only. */
  {
    id: "swiss-chalet-monday-chicken-and-ribs",
    title: "Chicken & Rib Monday",
    details: "A quarter chicken dinner with a third of a rack of BBQ back ribs for $19.99, Mondays only.",
    days: ["mon"],
    price: "$19.99",
    conditions: "At select locations. White meat is $2.00 extra; taxes, side upgrades and drinks are extra.",
    sourceUrl: "https://www.swisschalet.com/en/specials.html",
    verified: CHECKED,
    until: "2026-10-31",
    match: { kind: "brand", names: ["Swiss Chalet"], countries: ["CA"] },
  },
  {
    id: "swiss-chalet-tuesday-2-can-dine",
    title: "2 Can Dine Tuesday",
    details: "$19.99 every Tuesday with the purchase of two beverages. The site does not say what is included.",
    days: ["tue"],
    price: "$19.99",
    conditions: "At select locations. Dine-in, takeout and pickup, but not delivery. White meat is $2.00 extra.",
    sourceUrl: "https://www.swisschalet.com/en/specials.html",
    verified: CHECKED,
    until: "2026-10-31",
    match: { kind: "brand", names: ["Swiss Chalet"], countries: ["CA"] },
  },
  {
    id: "swiss-chalet-wednesday-kids-eat-free",
    title: "Kids eat free",
    details: "One free kids' meal with each adult entrée on Wednesdays.",
    days: ["wed"],
    conditions: "Kids 10 and under. Dine-in only, at select locations.",
    sourceUrl: "https://www.swisschalet.com/en/specials.html",
    verified: CHECKED,
    until: "2026-10-31",
    match: { kind: "brand", names: ["Swiss Chalet"], countries: ["CA"] },
  },

  /* Milestones */
  {
    id: "milestones-wednesday-date-night",
    title: "Date night",
    details: "Dinner for two for $75 every Wednesday.",
    days: ["wed"],
    price: "$75",
    conditions: "The site does not list which locations take part.",
    sourceUrl: "https://milestonesrestaurants.com/daily-deals/",
    verified: CHECKED,
    match: { kind: "brand", names: ["Milestones Grill & Bar", "Milestones"], countries: ["CA"] },
  },

  /* Turtle Jack's */
  {
    id: "turtle-jacks-tuesday-fajitas",
    title: "Fajita Tuesday",
    details: "A chicken fajita special on Tuesdays, with free chips and salsa. The site does not list the price.",
    days: ["tue"],
    conditions: "At participating locations only.",
    sourceUrl: "https://turtlejacks.com/features-and-specials/",
    verified: CHECKED,
    match: { kind: "brand", names: ["Turtle Jack's Muskoka Grill", "Turtle Jack's"], countries: ["CA"] },
  },

  /* Keenan's Irish Pub — Brampton (550 Queen St W) */
  {
    id: "keenans-brampton-monday-burger",
    title: "Keenan's Burger",
    details: "The Keenan's Burger, with fries, for $12.99 on Mondays.",
    days: ["mon"],
    price: "$12.99",
    sourceUrl: "https://keenansirishpub.ca/keenans-irish-pub-brampton/specials/",
    verified: CHECKED,
    match: {
      kind: "place",
      name: "Keenan's Irish Pub",
      lat: 43.6707576,
      lon: -79.7772941,
      address: "550 Queen St W #9",
      osm: "node/7545800445",
    },
  },
  {
    id: "keenans-brampton-tuesday-wings",
    title: "Wings & fries",
    details: "Wings and fries for $15.99 on Tuesdays, in several flavours.",
    days: ["tue"],
    price: "$15.99",
    sourceUrl: "https://keenansirishpub.ca/keenans-irish-pub-brampton/specials/",
    verified: CHECKED,
    match: {
      kind: "place",
      name: "Keenan's Irish Pub",
      lat: 43.6707576,
      lon: -79.7772941,
      address: "550 Queen St W #9",
      osm: "node/7545800445",
    },
  },
  {
    id: "keenans-brampton-wednesday-pub-fare",
    title: "Pub fare",
    details: "Classic pub fare such as shepherd's pie or bangers and mash for $15.99 on Wednesdays.",
    days: ["wed"],
    price: "$15.99",
    sourceUrl: "https://keenansirishpub.ca/keenans-irish-pub-brampton/specials/",
    verified: CHECKED,
    match: {
      kind: "place",
      name: "Keenan's Irish Pub",
      lat: 43.6707576,
      lon: -79.7772941,
      address: "550 Queen St W #9",
      osm: "node/7545800445",
    },
  },
  {
    id: "keenans-brampton-thursday-fish-and-chips",
    title: "Fish & chips",
    details: "Fish and chips for $15.99 on Thursdays.",
    days: ["thu"],
    price: "$15.99",
    sourceUrl: "https://keenansirishpub.ca/keenans-irish-pub-brampton/specials/",
    verified: CHECKED,
    match: {
      kind: "place",
      name: "Keenan's Irish Pub",
      lat: 43.6707576,
      lon: -79.7772941,
      address: "550 Queen St W #9",
      osm: "node/7545800445",
    },
  },
  {
    id: "keenans-brampton-sunday-kids-eat-free",
    title: "Kids eat free",
    details: "Kids eat free with the purchase of an adult entrée on Sundays.",
    days: ["sun"],
    sourceUrl: "https://keenansirishpub.ca/keenans-irish-pub-brampton/specials/",
    verified: CHECKED,
    match: {
      kind: "place",
      name: "Keenan's Irish Pub",
      lat: 43.6707576,
      lon: -79.7772941,
      address: "550 Queen St W #9",
      osm: "node/7545800445",
    },
  },

  /* Tracks Brew Pub — downtown Brampton (60 Queen St E) */
  {
    id: "tracks-brampton-monday-wing-night",
    title: "Wing night",
    details: "Wings for $9.00 a pound on Mondays.",
    days: ["mon"],
    price: "$9.00 per lb",
    conditions: "With a beverage. Not available for take-out.",
    sourceUrl: "https://www.tracksbrewpub.com/specials",
    verified: CHECKED,
    match: {
      kind: "place",
      name: "Tracks Brew Pub",
      lat: 43.6877696,
      lon: -79.7587389,
      address: "60 Queen St E",
      osm: "node/2071048424",
    },
  },
  {
    id: "tracks-brampton-thursday-combo-platter",
    title: "Combo platter",
    details: "A combo platter for $25.95 on Thursdays.",
    days: ["thu"],
    price: "$25.95",
    sourceUrl: "https://www.tracksbrewpub.com/specials",
    verified: CHECKED,
    match: {
      kind: "place",
      name: "Tracks Brew Pub",
      lat: 43.6877696,
      lon: -79.7587389,
      address: "60 Queen St E",
      osm: "node/2071048424",
    },
  },
  {
    id: "tracks-brampton-sunday-brew-and-wings",
    title: "Brew & wings",
    details: "2 lb of roaster wings with a pitcher of Old Mill Lager or Tracks Light Lager for $39.50 on Sundays.",
    days: ["sun"],
    price: "$39.50",
    sourceUrl: "https://www.tracksbrewpub.com/specials",
    verified: CHECKED,
    match: {
      kind: "place",
      name: "Tracks Brew Pub",
      lat: 43.6877696,
      lon: -79.7587389,
      address: "60 Queen St E",
      osm: "node/2071048424",
    },
  },
];
