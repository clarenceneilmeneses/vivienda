/**
 * Vivienda's own facts, used wherever Settings in the admin is still blank.
 * Anything the owner fills in under Settings wins over these.
 */
export const SITE = {
  name: "Vivienda",
  tagline: "Our Tropical Haven",
  about:
    "Relax, unwind, and enjoy exclusive access to our private pool. Designed for comfort, cleanliness, and peace of mind—your personal oasis awaits. Experience serenity, comfortable lounging spaces, and a tranquil atmosphere that create the perfect escape.",
  phone: "0995 496 6063",
  phoneHref: "tel:+639954966063",
  email: "vivienda.ivorygem@gmail.com",
  address: "Muzon 1st, Alitagtag, Philippines, 4205",
  facebook: "https://www.facebook.com/profile.php?id=61583823161485",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=Muzon+1st,+Alitagtag,+Batangas+4205",
} as const;

/**
 * The promo banner on the home page. Set `until` to the last day it runs
 * (YYYY-MM-DD); after that it hides itself. Set `promo` to null to remove it.
 */
export const PROMO: {
  title: string;
  headline: string;
  price: string;
  details: string;
  until: string;
} | null = {
  title: "September BERy-Affordable Promo",
  headline: "Weekday Day Tour · Unli Pax",
  price: "₱7,999",
  details: "Exclusive use of the whole place for your group on any weekday day tour, no head count limit.",
  until: "2026-09-30",
};

/** Property photos, served from /public/images. */
export const PHOTOS = {
  aerial: { src: "/images/aerial.jpg", alt: "Aerial view of Vivienda: the A-frame, the pool and the garden" },
  poolAframe: { src: "/images/pool-aframe.jpg", alt: "The pool and kiddie pool in front of the glass A-frame" },
  lounge: { src: "/images/aframe-lounge.jpg", alt: "Rattan loungers beside the pool under the A-frame" },
  garden: { src: "/images/garden-sunset.jpg", alt: "Garden picnic tables with umbrellas at sunset" },
  trellis: { src: "/images/facade-trellis.jpg", alt: "The A-frame and villa seen through the bamboo arch" },
  front: { src: "/images/front.jpg", alt: "The front of Vivienda with its wooden fence" },
  driveway: { src: "/images/driveway.jpg", alt: "Driveway leading to the covered pool area" },
  gate: { src: "/images/gate.jpg", alt: "The entrance gate and driveway at dusk" },
  poolWaterfall: { src: "/images/pool-waterfall.jpg", alt: "The pool's waterfall in front of the A-frame and villa" },
  poolOvercast: { src: "/images/pool-overcast.jpg", alt: "The pool and kiddie pool beside the glass A-frame" },
  pavilionPool: { src: "/images/pavilion-pool.jpg", alt: "The pool seen from the covered pavilion" },
  billiards: { src: "/images/billiards.jpg", alt: "Billiards table in the pavilion beside the pool" },
  loungeSign: { src: "/images/lounge-sign.jpg", alt: "Rattan lounge under the Vivienda sign" },
  aframeStairs: { src: "/images/aframe-stairs.jpg", alt: "Inside the A-frame: living area and stairs to the loft" },
  aframeTv: { src: "/images/aframe-tv.jpg", alt: "TV wall and party speaker inside the A-frame" },
  aframeLoft: { src: "/images/aframe-loft-bed.jpg", alt: "The air-conditioned A-frame loft" },
  bunkRoom: { src: "/images/bunk-room.jpg", alt: "Group room with bunk beds and a sofa bed" },
  bunkBalcony: { src: "/images/bunk-balcony.jpg", alt: "Bunk room opening onto the balcony" },
  kitchen: { src: "/images/kitchen.jpg", alt: "Kitchen with sink and two-burner stove" },
  gardenWide: { src: "/images/garden-wide.jpg", alt: "The garden lawn with picnic tables and umbrellas" },
  gardenUmbrellas: { src: "/images/garden-umbrellas.jpg", alt: "Garden picnic tables under umbrellas" },
  playground: { src: "/images/playground.jpg", alt: "Kids' play area with slides and a swing" },
  events: { src: "/images/event-setup.jpg", alt: "The pavilion set up for a celebration" },
  group: { src: "/images/group-aframe.jpg", alt: "A group of guests in front of the A-frame" },
} as const;

/** Every property photo, in the order the gallery shows them. */
export const GALLERY = [
  PHOTOS.poolWaterfall,
  PHOTOS.aframeStairs,
  PHOTOS.gardenUmbrellas,
  PHOTOS.billiards,
  PHOTOS.bunkRoom,
  PHOTOS.pavilionPool,
  PHOTOS.loungeSign,
  PHOTOS.aframeLoft,
  PHOTOS.playground,
  PHOTOS.kitchen,
  PHOTOS.events,
  PHOTOS.poolAframe,
  PHOTOS.aframeTv,
  PHOTOS.gardenWide,
  PHOTOS.bunkBalcony,
  PHOTOS.group,
  PHOTOS.poolOvercast,
  PHOTOS.lounge,
  PHOTOS.garden,
  PHOTOS.trellis,
  PHOTOS.aerial,
  PHOTOS.front,
  PHOTOS.driveway,
  PHOTOS.gate,
];

export const LOCATION_LABEL = "Alitagtag, Batangas";

/** From the resort's own fact sheet. Shown on a stay page when the room has no amenities of its own. */
export const DEFAULT_AMENITIES = [
  "Private pool, adult and kids",
  "Karaoke",
  "Bonfire station",
  "BBQ griller",
  "Refrigerator",
  "2-burner stove",
  "Basic utensils",
  "Dining area with tables and chairs",
  "Badminton, billiards and board games",
  "PLDT WiFi",
  "Smart TV",
  "Free Netflix & YouTube",
];

/** Beds, from the fact sheet. */
export const SLEEPING: { room: string; beds: string[] }[] = [
  { room: "A-House", beds: ["2 double-size beds", "1 queen-size sofa bed", "Single bed (upon request)"] },
  { room: "Stilt Room", beds: ["3 double-size double-deck beds", "1 queen sofa bed"] },
];

/**
 * Real recommendations from the Facebook page (9 of 9 recommend, as of
 * Sep 25, 2026). Copied as written; long ones end where Facebook cut them off.
 */
export const REVIEWS: { author: string; month: string; body: string }[] = [
  {
    author: "Kathy Bunyi Gaa",
    month: "August 2026",
    body: "We celebrated my niece's birthday at Vivienda Resort, and we had such a wonderful experience! The place is peaceful, clean, and well-maintained, making it perfect for a relaxing family gathering. Since the resort is exclusive, we really enjoyed having the whole place to ourselves, perfect for family celebrations, reunions, and intimate gatherings.",
  },
  {
    author: "Joy DM II",
    month: "March 2026",
    body: "Super enjoyed our stay at Vivienda! The cabin is spacious and cozy. Hindi kami nabored because may billiard table, board games, and karaoke. Very exclusive din yung place so we really had a relaxing time, and we loved that we could swim in the pool anytime. Plus, the resort owner is very accommodating and mabait. Highly recommended for a private getaway!",
  },
  {
    author: "Tom Lester Aro Barrion",
    month: "April 2026",
    body: "Highly recommended! The place is very clean and beautiful. The owner and staff are all very kind and accommodating. It's absolutely perfect for a family outing. We had such a great time here with my whole family, definitely a place we'd love to visit again!",
  },
  {
    author: "Arra Curaming Patrocenio",
    month: "February 2026",
    body: "Awesome experience at Vivienda! The place is absolutely beautiful - clean, well-maintained, refreshing and thoughtfully designed for comfort and privacy. Napakabait kausap and very accommodating pa si Owner at staff nito, kaya naging very smooth ang transaction. Our stay and birthday celebration turned out to be truly enjoyable and memorable.",
  },
  {
    author: "Gared Christian Abrenica",
    month: "March 2026",
    body: "Highly recommended po, sobrang convenient po ng place along with the included amenities, such as the pool, the bedrooms with multiple decks, pantry with kitchenwares, and the billiards along with other mini games in the resort itself.",
  },
  {
    author: "Chona Dimalanta",
    month: "June 2026",
    body: "Highly recommended!! Super bait at accommodating ng owner at caretaker. Malinis, maganda at relaxing ng place.",
  },
  {
    author: "King Marpee Agena",
    month: "March 2026",
    body: "10/10 highly recommended, spacious at maganda ang mismong place. Convenient dahil malapit sa mga stores like Alfamart at Dali.",
  },
  {
    author: "Cenon Dove Balbanida",
    month: "February 2026",
    body: "Very satisfied couple here sa service nyo, sobrang ganda ng venue and very accommodating. Feel na feel at home kami kaya naging successful at maganda ang kinalabasan ng aming prenup. Recommendable! Thank you Vivienda!",
  },
  {
    author: "Rosevel Arenas Cayabyab",
    month: "September 2026",
    body: "Peaceful vibes with lots of activities to enjoy. Spacious rooms.",
  },
];

/** The Facebook rating line: every reviewer recommends. */
export const RECOMMEND = { percent: 100, count: REVIEWS.length };
