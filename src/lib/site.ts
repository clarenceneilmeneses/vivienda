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
} as const;
