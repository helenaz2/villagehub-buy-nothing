# 90-second demo

## Before you go on

- On the laptop: `npx expo start --tunnel --clear`, then open the app on the phone from the QR code. Do this before you're called up, not on stage.
- On the phone: long-press the **Curbside** wordmark on the camera screen and tap **Reset data**, then long-press again to close the panel. This puts the demo listings, messages and impact numbers back to the start.
- Turn on Do Not Disturb, turn brightness up, and turn on screen mirroring if the room has a projector.
- Everything below uses **Samples**, so it works with no signal. A real scan is optional (see the end).

## The pitch (say this first, 15 seconds)

"Getting rid of a couch the right way means photos, measuring, writing a listing, answering messages and arranging a pickup. Most people give up and it ends up on the curb. Curbside turns all of that into one photo."

## The demo

**0:00 Open on the camera.**
"Curbside opens straight to the camera. There's no form to fill in, ever."

**0:05 Scan the sofa.** Tap **Samples**, then **Sofa** (or point at a real one and press the shutter).
The reticle tightens, sweeps, then snaps onto the sofa and names it.
"About two seconds to go from a photo to a full listing."

**0:15 Show the listing it wrote.** Scroll slowly.
"Name, condition, size, how many people it takes to carry, weight, material, tags and a description in a neighbor's voice. It's honest about doubt: it wasn't sure about the size, so that's marked for me to check. Everything is a tap to change."
Bump the width with the stepper once to show it.

**0:30 Publish.** Tap **Publish**. The tag drops and swings.
A few seconds later: "Maya would like it."
"Maya lives two blocks over. She can't see my address yet. It's shared only after I confirm her."

**0:40 Chat and pick a time.** Tap **See who is interested**, then **Open chat with the claimant**.
Tap one of the suggested times, then the quick reply **That time works**. Maya answers.
"Times are suggested, there's a porch-pickup option, and one tap adds it to the calendar."

**0:52 QR handoff.** Tap **Code**.
"When Maya picks it up, she scans this. That one scan closes the listing and asks both of us for a rating."
Tap **Demo: Maya scans the code**. "Handed off. 130 pounds out of the landfill."
Tap a star rating and **Done**.

**1:05 Scan the broken chair.** Go to **Scan**, then **Samples**, then **Broken chair**.
"Now something nobody should be given."
The recommendation is **Recycle or dispose**: "A broken leg makes it unsafe to sit on, so it should not go to a neighbor."
Tap **Find the best place for it**.

**1:15 The finder.**
"Ranked by how much good each option does with this item. Charities only take items in good shape, so they're honestly listed under the places that won't take it. The best match is Urban Ore, a Berkeley reuse yard that can repair it or salvage the wood. City pickup, which goes to landfill, ranks below it, and a paid hauler is last."
Tap the score chip to show the breakdown.

**1:25 End on impact.** Tap **I am going with this one**.
"That lands on my impact page: pounds diverted, CO2 avoided and money saved for neighbors, with the assumptions one tap away."

## Optional: a real scan

If the laptop's `.env` has a `GEMINI_API_KEY` and the phone is connected, point the camera at a real chair or lamp in the room and press the shutter. It takes a few seconds. If it guesses wrong, tap the right answer in the **Not a ___?** row on the edit screen and it re-scans.

Do this after the scripted demo, not in the middle of it, so a slow network can't eat your 90 seconds.

## Questions judges are likely to ask

- **"Is the AI real?"** Yes. With a key, the photo goes to Gemini through the laptop, which returns a validated listing. The samples are canned results, so the demo can't fail on bad Wi-Fi. That's why the real scan is shown separately.
- **"What about payments?"** The claim screen explains a payment hold, but no money moves yet. Stripe Connect is next on the list in [LIMITATIONS.md](LIMITATIONS.md).
- **"Where do the donation places come from?"** Twelve Berkeley and Oakland places, checked by hand, each with its source and the date it was checked.
- **"How is my address protected?"** Listings only show a location blurred to about 300 m. The exact address is shared after the owner confirms who is picking it up.

## If something goes wrong

- A real scan hangs or the network drops: tap **Samples** and carry on. The debug panel (long-press the wordmark) shows whether the last result was live or a sample.
- You tapped the wrong thing: debug panel, **Reset data**.
- To show the other side, tap **Be Maya** in the debug panel.
