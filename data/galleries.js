/* ==========================================================================
   GALLERIES  —  named photo sets used by the visual components
   (depth-carousel, morph-slider, and anything else that takes a `gallery` key).

   Add a photo: drop the file into  assets/img/gallery/  then add a line to the
   set you want it to appear in. Nothing to rebuild.

   Fields:
     image    path relative to the site root, e.g.
              "assets/img/gallery/reveal-night.jpg". A value containing "://"
              or starting with "/" is used exactly as written, so an externally
              hosted photo works too.
     alt      plain description for screen readers and for the moment before
              the file loads. Describe what is in the frame, not the mood.
     caption  the line printed under or over the photo. Keep it short and
              dignified — a title, not a sentence.

   Landscape crops (roughly 3:2) sit best in the carousel; the slider fills
   whatever box it is given and crops to cover, so anything works there.
   ========================================================================== */
window.LPHIE = window.LPHIE || {};

window.LPHIE.galleries = {

  /* The chapter at large — used on about.html. */
  /* The chapter's own record — the photographs that belong beside the history.
     More archival scans are to be added here as they are dug out. */
  archive: [
    {
      image: "assets/img/gallery/archive-house-2000s.jpg",
      alt: "Archival photograph of the chapter outside a house in the mid-2000s",
      caption: "The chapter, mid-2000s"
    },
    {
      image: "assets/img/gallery/archive-shots-night.jpg",
      alt: "Archival photograph of brothers at a chapter social",
      caption: "A night out, mid-2000s"
    },
    {
      image: "assets/img/gallery/charter-class-throwback.jpg",
      alt: "Archival photograph of Alpha Xi brothers in the mid-2000s",
      caption: "Charter-class brothers, mid-2000s"
    },
    {
      image: "assets/img/gallery/archive-go-live.jpg",
      alt: "Archival photograph of three brothers at a chapter event",
      caption: "Brothers out, early 2010s"
    },
    {
      image: "assets/img/gallery/alumni-homecoming.jpg",
      alt: "Alumni returning to the chapter for homecoming",
      caption: "Alumni homecoming"
    }
  ],

  about: [
    {
      image: "assets/img/gallery/summer-in-the-city.jpg",
      alt: "Brothers downtown on a summer afternoon",
      caption: "Summer in the city"
    },
    {
      image: "assets/img/gallery/convention-weekend.jpg",
      alt: "Brothers gathered at a national convention weekend",
      caption: "Convention weekend, delegates of the chapter"
    },
    {
      image: "assets/img/gallery/interchapter-formal.jpg",
      alt: "Brothers from several chapters at a formal dinner",
      caption: "Interchapter formal"
    },
    {
      image: "assets/img/gallery/reveal-night.jpg",
      alt: "New members revealed to the chapter at night",
      caption: "Reveal night"
    }
  ],

  /* Family lines and the smaller rooms — used on brotherhood.html. */
  families: [
    {
      image: "assets/img/gallery/family-line-dinner.jpg",
      alt: "A family line seated together at dinner",
      caption: "Family line dinner"
    },
    {
      image: "assets/img/gallery/house-social.jpg",
      alt: "Brothers and guests at a house social",
      caption: "House social"
    },
    {
      image: "assets/img/gallery/mixer-night.jpg",
      alt: "Brothers at a mixer with another chapter",
      caption: "Mixer night"
    },
    {
      image: "assets/img/gallery/hotpot-night.jpg",
      alt: "Brothers around a shared hotpot table",
      caption: "Hotpot night"
    },
    {
      image: "assets/img/gallery/mahjong-night.jpg",
      alt: "A mahjong table mid-game",
      caption: "Mahjong night"
    }
  ],

  /* The long version of brotherhood — the flagship set. */
  brotherhood: [
    {
      image: "assets/img/gallery/convertible-drive.jpg",
      alt: "Brothers on a drive with the top down at golden hour",
      caption: "Golden-hour drive"
    },
    {
      image: "assets/img/gallery/pool-party.jpg",
      alt: "Brothers at a summer pool party",
      caption: "Summer pool party"
    },
    {
      image: "assets/img/gallery/retreat-after-dark.jpg",
      alt: "The chapter retreat after nightfall",
      caption: "Retreat, after dark"
    },
    {
      image: "assets/img/gallery/hotpot-night.jpg",
      alt: "Brothers around a shared hotpot table",
      caption: "Hotpot night"
    },
    {
      image: "assets/img/gallery/mahjong-night.jpg",
      alt: "A mahjong table mid-game",
      caption: "Mahjong night"
    },
    {
      image: "assets/img/gallery/late-nights.jpg",
      alt: "Brothers studying and talking late into the night",
      caption: "Late nights"
    },
    {
      image: "assets/img/gallery/reveal-night.jpg",
      alt: "New members revealed to the chapter at night",
      caption: "Reveal night"
    }
  ],

  /* Service and the causes the chapter carries — philanthropy.html. */
  philanthropy: [
    {
      image: "assets/img/gallery/stem-cell-drive.jpg",
      alt: "Brothers registering donors at a stem cell drive",
      caption: "Stem cell registry drive"
    },
    {
      image: "assets/img/gallery/sporting-life-10k.jpg",
      alt: "Brothers running the Sporting Life 10K",
      caption: "Sporting Life 10K"
    },
    {
      image: "assets/img/gallery/alumni-banquet.jpg",
      alt: "Alumni and actives at the annual banquet",
      caption: "Annual banquet"
    }
  ],

  /* Brothers who came before — alumni.html. */
  alumni: [
    {
      image: "assets/img/gallery/alumni-banquet.jpg",
      alt: "Alumni and actives at the annual banquet",
      caption: "Alumni banquet"
    },
    {
      image: "assets/img/gallery/alumni-homecoming.jpg",
      alt: "Alumni returning to campus for homecoming",
      caption: "Homecoming, alumni returning"
    },
    {
      image: "assets/img/gallery/charter-class-throwback.jpg",
      alt: "Archival photograph of the chapter's charter class",
      caption: "Charter-class brothers, mid-2000s"
    },
    {
      image: "assets/img/gallery/interchapter-formal.jpg",
      alt: "Brothers from several chapters at a formal dinner",
      caption: "Interchapter formal"
    }
  ],

  /* The mixed reel — media.html. */
  media: [
    {
      image: "assets/img/gallery/reveal-night.jpg",
      alt: "New members revealed to the chapter at night",
      caption: "Reveal night"
    },
    {
      image: "assets/img/gallery/convention-weekend.jpg",
      alt: "Brothers gathered at a national convention weekend",
      caption: "Convention weekend"
    },
    {
      image: "assets/img/gallery/pool-party.jpg",
      alt: "Brothers at a summer pool party",
      caption: "Summer pool party"
    },
    {
      image: "assets/img/gallery/summer-in-the-city.jpg",
      alt: "Brothers downtown on a summer afternoon",
      caption: "Summer in the city"
    },
    {
      image: "assets/img/gallery/convertible-drive.jpg",
      alt: "Brothers on a drive with the top down at golden hour",
      caption: "Golden-hour drive"
    },
    {
      image: "assets/img/gallery/sporting-life-10k.jpg",
      alt: "Brothers running the Sporting Life 10K",
      caption: "Sporting Life 10K"
    }
  ]
};
