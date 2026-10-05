/* ============================================================
   NAMMA SANTHAI — interactive PWA trial (front-end only)
   Plain vanilla JS. State persists in localStorage. No backend:
   OTP is simulated on-screen, admin role is a labelled demo toggle,
   messaging/approval run client-side. Matches the MVP screen map.
   ============================================================ */
(function () {
  "use strict";
  // Bumped to v4 on 5 Oct 2026: v3 phones had seeded demo listings saved in
  // localStorage, so the "remove fake data" fix did nothing for anyone who had
  // already opened the app. Changing the key discards that old state.
  var LS = "ns_state_v4";

  /* ---------- brand mark (inline SVG, no emoji logo) ---------- */
  var LOGO = '<svg viewBox="0 0 64 64" aria-hidden="true">'
    + '<rect x="2" y="2" width="60" height="60" rx="16" fill="#15663a"/>'
    + '<g stroke="#c9992b" stroke-width="2.4" stroke-linecap="round">'
    + '<line x1="32" y1="9" x2="32" y2="15"/><line x1="20" y1="12" x2="22.5" y2="17"/>'
    + '<line x1="44" y1="12" x2="41.5" y2="17"/><line x1="12" y1="20" x2="17" y2="23"/>'
    + '<line x1="52" y1="20" x2="47" y2="23"/></g>'
    + '<path d="M18 30c-5-4-9-3-11 1 3 6 8 6 12 3z" fill="#f6f1e7"/>'
    + '<path d="M46 30c5-4 9-3 11 1-3 6-8 6-12 3z" fill="#f6f1e7"/>'
    + '<path d="M24 26c0-6 4-10 8-10s8 4 8 10c0 8-4 14-8 17-4-3-8-9-8-17z" fill="#f6f1e7"/>'
    + '<circle cx="28.5" cy="30" r="1.8" fill="#15663a"/><circle cx="35.5" cy="30" r="1.8" fill="#15663a"/>'
    + '<path d="M30 40c1.2 1.6 3 1.6 4 0" stroke="#15663a" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
    + '</svg>';
  var BRAND_SM = '<span class="brand-sm">' + LOGO + '<span>NAMMA SANTHAI</span></span>';

  /* ---------- categories ---------- */
  var CATS = [
    {k:"goat",e:"🐐",en:"Goat",ta:"ஆடு"},{k:"sheep",e:"🐑",en:"Sheep",ta:"செம்மறி"},
    {k:"cow",e:"🐄",en:"Cow",ta:"பசு"},{k:"buffalo",e:"🐃",en:"Buffalo",ta:"எருமை"},
    {k:"poultry",e:"🐓",en:"Poultry",ta:"கோழி"},{k:"feed",e:"🌾",en:"Feed",ta:"தீவனம்"},
    {k:"vegetables",e:"🥬",en:"Vegetables",ta:"காய்கறி"},{k:"fruit",e:"🍌",en:"Fruit",ta:"பழம்"},
    {k:"seeds",e:"🌱",en:"Seeds",ta:"விதை"},{k:"machinery",e:"🚜",en:"Machinery",ta:"இயந்திரம்"},
    {k:"car",e:"🚗",en:"Car",ta:"கார்"},{k:"bike",e:"🏍️",en:"Bike",ta:"பைக்"},
    {k:"other",e:"📦",en:"Other",ta:"மற்றவை"}
  ];
  var catMeta = function(k){ for(var i=0;i<CATS.length;i++) if(CATS[i].k===k) return CATS[i]; return CATS[CATS.length-1]; };

  /* ---------- i18n ---------- */
  var T = {
    en:{
      tagline:"Buy · Sell · Support Our Farmers", chooseLang:"Choose your language",
      welcomeBlurb:"Your local market for goats, sheep, cattle, farm goods and vehicles — near you, in Tamil Nadu.",
      letsBegin:"Let's Begin", trialNote:"Trial: sign in with your mobile number. No password, no code.",
      enterMobile:"Enter your mobile number", otpSub:"We'll send a 6-digit code to verify your number.",
      noOtpSub:"Enter your mobile number to sign in. No password needed.",
      emptyFeed:"No listings yet. Be the first to post one.",
      liveTitle:"Your ad is live",
      liveNow:"Live now",
      liveExplain:"It is visible to buyers straight away. Our team reviews ads afterwards and will contact you if anything needs changing.",
      liveToast:"Ad posted - live now",
      notifAskTitle:"Turn on notifications",
      notifAskSub:"Get alerted when a buyer messages you or a goat is listed near you.",
      notifAllow:"Allow", notifOn:"Notifications on", notifOff:"Notifications off",
      notifBlocked:"Blocked in your browser settings.",
      notifTest:"Test", notifTestTitle:"Namma Santhai",
      notifTestBody:"Notifications are working on this device.",
      notifTestSent:"Test push sent - close the app and it still arrives",
      notifTestNoDevice:"This device is not registered for push yet",
      adminByNumber:"Granted by your phone number, not a switch.",
      photoFailed:"Could not read that photo. Try another.",
      noOtpNote:"Trial: signing in with a number only. No code is sent and the number is not verified.",
      mobileLabel:"Mobile number", sendOtp:"Send OTP", or:"OR", google:"Continue with Google",
      privacyNote:"Your number is private. Buyers never see it unless you turn on contact.",
      errPhone:"Enter a valid 10-digit Indian mobile number",
      verifyTitle:"Verify your number", verifySub:"Enter the 6-digit code sent to",
      demoCodeLabel:"Demo code (shown on screen — no SMS)", verify:"Verify",
      resendIn:"Resend code in", resendNow:"Resend code", editNumber:"Edit number",
      errOtp:"Incorrect code. Please try again.", errOtpAttempts:"Too many attempts. Resend a new code.",
      completeProfile:"Complete your profile", profileSub:"This helps buyers and sellers connect with you.",
      addPhoto:"Add profile photo (optional)", yourName:"Your name", yourLocation:"Your location",
      errName:"Please enter your name", continue:"Continue",
      demoUnverified:"Demo number — not a verified contact",
      searchPh:"Search goats, feed, vehicles…", featured:"Featured near you", seeAll:"See all",
      safety:"Visit and inspect before paying. Never send advance payment because of an ad.",
      browse:"Browse", categories:"Categories", allCats:"All categories",
      goatsNearYou:"Near you", change:"Change", withinKm:"Within", kmAway:"km away",
      permTitle:"Show listings near you", permMsg:"Allow location to sort by distance, or enter it manually.",
      allowLoc:"Allow location", enterManual:"Enter manually", notNow:"Not now",
      locDeniedHelp:"Location is off. Turn on Settings ▸ Location, or enter your district/village below.",
      noResults:"No listings here yet", tryReset:"Reset filters", comingSoon:"More listings coming soon",
      message:"Message", call:"Call", whatsapp:"WhatsApp",
      contactShareNote:"Call / WhatsApp shares your number with the seller.",
      noCall:"Seller has not enabled phone contact", noWa:"Seller has not enabled WhatsApp",
      descLabel:"Description", details:"Details",
      specBreed:"Breed", specAge:"Age", specSex:"Sex", specHealth:"Health", specWeight:"Weight",
      specYear:"Year", specKms:"Kilometres", specCondition:"Condition",
      male:"Male", female:"Female", vaccinated:"Vaccinated", viewSeller:"View seller profile",
      memberSince:"Member since", activeAds:"Active ads", sellerProfile:"Seller profile",
      postAd:"Post Your Ad", adType:"Ad type", forSale:"For sale", wanted:"Wanted",
      category:"Category", title:"Title", price:"Price (₹)", unit:"Price unit",
      unitEach:"Each", unitKg:"Per kg", unitTotal:"Total", qty:"Quantity",
      description:"Description", descPh:"Condition, age, why you're selling…",
      photos:"Photos", photoHint:"at least 1 clear photo — show the whole animal",
      wantedPhotoHint:"photo optional for wanted ads", addPhotoBtn:"Add photo", video:"Video (optional)",
      addVideo:"Add video", locationReq:"Location", useGps:"Use current location",
      manualLoc:"Enter manually", district:"District", village:"Village / Taluk",
      next:"Next", errTitle:"Add a title", errPrice:"Add a valid price", errDesc:"Add a description",
      errPhoto:"Add at least one photo", errLoc:"Choose GPS or enter your district & village",
      fixErrors:"Please fix the highlighted fields.",
      previewAd:"Preview your ad", previewNote:"Check everything is correct before submitting.",
      photoOk:"Whole animal visible, not cropped.", submitApproval:"Submit for Approval",
      saving:"Saving…", submittedTitle:"Ad submitted for approval",
      submittedTa:"", pendingExplain:"Your ad is under review. It won't appear in the public feed until our team approves it — usually within a few hours.",
      goMyListings:"Go to My Listings", backHome:"Back to Home",
      myListings:"My Listings", tabPending:"Pending", tabActive:"Active", tabRejected:"Rejected", tabSold:"Sold",
      views:"views", edit:"Edit", markSold:"Mark Sold", del:"Delete", relist:"Edit & resubmit",
      rejReasonLabel:"Reason", noneHere:"Nothing here yet",
      wantedAds:"Wanted ads", wantedBlurb:"Buyers looking for animals & goods.",
      notifications:"Notifications", markRead:"Mark all read", noNotifs:"No notifications yet",
      nApproved:"Ad approved", nRejected:"Ad rejected", nMessage:"New message", nNearby:"New near you",
      messages:"Messages", noChats:"No conversations yet", typeMsg:"Type a message…",
      online:"Online", lastSeen:"last seen", minAgo:"min ago", hrAgo:"hr ago", justNow:"just now",
      myProfile:"My Profile", verified:"Verified", language:"Language",
      contactPerms:"Contact permissions", allowCall:"Allow buyers to call me",
      allowWa:"Allow WhatsApp", profilePhoto:"Profile Photo", optional:"Optional",
      settings:"Settings", notifTopics:"Alert categories", alertRadius:"Alert radius",
      locationHelp:"Location permission help", account:"Account & privacy",
      deleteAccount:"Delete my account", replayTour:"Replay start tour", logout:"Log out",
      adminMode:"Admin mode (demo)", adminQueue:"Approval Queue", approve:"Approve", reject:"Reject",
      rejectReasonPh:"Why is this rejected? (shown to seller)", submitReject:"Confirm reject",
      needReason:"Please enter a reason", noPending:"No ads waiting for approval", pending:"pending",
      seller:"Seller", submitted:"Submitted", quantity:"Qty",
      navHome:"Home", navSearch:"Search", navSell:"Sell", navMessages:"Messages", navProfile:"Profile",
      // toasts
      otpSent:"Code sent (demo)", approvedToast:"Listing approved — now live",
      rejectedToast:"Listing rejected", soldToast:"Marked as sold", deletedToast:"Listing deleted",
      postedToast:"Submitted for approval", locToast:"Location detected", locManualToast:"Location saved",
      photoAdded:"Photo added (demo)", markedRead:"All marked read", langToast:"Language changed",
      savedToast:"Saved", resetToast:"Demo reset", waToast:"Opening WhatsApp…", callToast:"Calling…",
      loginToast:"Welcome to Namma Santhai!", selfChat:"That's your own listing."
    },
    ta:{
      tagline:"வாங்க · விற்க · விவசாயிகளை ஆதரிக்க", chooseLang:"உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்",
      welcomeBlurb:"ஆடு, செம்மறி, கால்நடை, விவசாயப் பொருட்கள் மற்றும் வாகனங்களுக்கான உங்கள் உள்ளூர் சந்தை — தமிழ்நாட்டில், உங்களுக்கு அருகில்.",
      letsBegin:"தொடங்கலாம்", trialNote:"சோதனை: மொபைல் எண்ணில் உள்நுழையவும். கடவுச்சொல் இல்லை.",
      noOtpSub:"உள்நுழைதல்: மொபைல் எண் மட்டும் போதும்.",
      noOtpNote:"சோதனை: எண் மூலம் மட்டும் உள்நுழைவு.",
      emptyFeed:"இன்னும் விளம்பரங்கள் இல்லை. முதலில் நீங்கள் இடுங்கள்.",
      liveTitle:"உங்கள் விளம்பரம் நேரலையில்",
      liveNow:"இப்போது நேரலையில்",
      liveExplain:"வாங்குபவர்களுக்கு உடனே தெரியும். எங்கள் குழு பின்னர் சரிபார்க்கும்.",
      liveToast:"விளம்பரம் வெளியிடப்பட்டது",
      notifAskTitle:"அறிவிப்புகளை இயக்கவும்",
      notifAskSub:"வாங்குபவர் செய்தி அனுப்பும்போது அல்லது அருகில் ஆடு வரும்போது அறிவிப்பு பெறுங்கள்.",
      notifAllow:"அனுமதி", notifOn:"அறிவிப்புகள் இயக்கத்தில்", notifOff:"அறிவிப்புகள் அணைக்கப்பட்டது",
      notifBlocked:"உலாவி அமைப்புகளில் தடுக்கப்பட்டுள்ளது.",
      notifTest:"சோதனை", notifTestTitle:"நம்ம சந்தை",
      notifTestBody:"இந்த சாதனத்தில் அறிவிப்புகள் வேலை செய்கின்றன.",
      notifTestSent:"சோதனை அறிவிப்பு அனுப்பப்பட்டது",
      notifTestNoDevice:"இந்த சாதனம் இன்னும் பதிவு செய்யப்படவில்லை",
      adminByNumber:"உங்கள் தொலைபேசி எண் மூலம் வழங்கப்படுகிறது.",
      photoFailed:"படத்தைப் படிக்க முடியவில்லை. வேறு ஒன்றை முயற்சிக்கவும்.",
      enterMobile:"உங்கள் மொபைல் எண்ணை உள்ளிடவும்", otpSub:"உங்கள் எண்ணைச் சரிபார்க்க 6-இலக்க குறியீடு அனுப்புவோம்.",
      mobileLabel:"மொபைல் எண்", sendOtp:"OTP அனுப்பு", or:"அல்லது", google:"Google மூலம் தொடரவும்",
      privacyNote:"உங்கள் எண் தனிப்பட்டது. தொடர்பை இயக்கும் வரை வாங்குபவர்கள் பார்க்க முடியாது.",
      errPhone:"சரியான 10-இலக்க இந்திய மொபைல் எண்ணை உள்ளிடவும்",
      verifyTitle:"உங்கள் எண்ணைச் சரிபார்க்கவும்", verifySub:"அனுப்பப்பட்ட 6-இலக்க குறியீட்டை உள்ளிடவும்",
      demoCodeLabel:"மாதிரி குறியீடு (திரையில் காட்டப்படுகிறது — SMS இல்லை)", verify:"சரிபார்",
      resendIn:"மீண்டும் அனுப்ப", resendNow:"குறியீட்டை மீண்டும் அனுப்பு", editNumber:"எண்ணைத் திருத்து",
      errOtp:"தவறான குறியீடு. மீண்டும் முயற்சிக்கவும்.", errOtpAttempts:"அதிக முயற்சிகள். புதிய குறியீட்டை அனுப்பவும்.",
      completeProfile:"உங்கள் சுயவிவரத்தை நிரப்பவும்", profileSub:"இது வாங்குபவர்களையும் விற்பவர்களையும் இணைக்க உதவும்.",
      addPhoto:"சுயவிவரப் படம் சேர்க்கவும் (விருப்பம்)", yourName:"உங்கள் பெயர்", yourLocation:"உங்கள் இடம்",
      errName:"உங்கள் பெயரை உள்ளிடவும்", continue:"தொடரவும்",
      demoUnverified:"மாதிரி எண் — சரிபார்க்கப்பட்ட தொடர்பு அல்ல",
      searchPh:"ஆடு, தீவனம், வாகனம் தேடு…", featured:"உங்களுக்கு அருகில் சிறப்பு", seeAll:"அனைத்தும்",
      safety:"பணம் செலுத்தும் முன் நேரில் பார்த்து உறுதிசெய்யுங்கள். விளம்பரத்திற்காக முன்பணம் அனுப்பாதீர்கள்.",
      browse:"உலாவு", categories:"வகைகள்", allCats:"அனைத்து வகைகள்",
      goatsNearYou:"அருகில்", change:"மாற்று", withinKm:"எல்லைக்குள்", kmAway:"கி.மீ தொலைவில்",
      permTitle:"அருகிலுள்ள பட்டியல்களைக் காட்டு", permMsg:"தூரம் வாரியாக வரிசைப்படுத்த இருப்பிடத்தை அனுமதிக்கவும் அல்லது கைமுறையாக உள்ளிடவும்.",
      allowLoc:"இருப்பிடத்தை அனுமதி", enterManual:"கைமுறையாக உள்ளிடு", notNow:"இப்போது வேண்டாம்",
      locDeniedHelp:"இருப்பிடம் முடக்கப்பட்டுள்ளது. அமைப்புகள் ▸ இருப்பிடம் இயக்கவும், அல்லது கீழே மாவட்டம்/கிராமத்தை உள்ளிடவும்.",
      noResults:"இங்கே இன்னும் பட்டியல்கள் இல்லை", tryReset:"வடிகட்டிகளை மீட்டமை", comingSoon:"மேலும் விரைவில்",
      message:"செய்தி", call:"அழை", whatsapp:"WhatsApp",
      contactShareNote:"அழை / WhatsApp உங்கள் எண்ணை விற்பவருடன் பகிரும்.",
      noCall:"விற்பவர் தொலைபேசி தொடர்பை இயக்கவில்லை", noWa:"விற்பவர் WhatsApp இயக்கவில்லை",
      descLabel:"விவரம்", details:"விவரங்கள்",
      specBreed:"இனம்", specAge:"வயது", specSex:"பாலினம்", specHealth:"ஆரோக்கியம்", specWeight:"எடை",
      specYear:"வருடம்", specKms:"கி.மீ ஓட்டம்", specCondition:"நிலை",
      male:"ஆண்", female:"பெண்", vaccinated:"தடுப்பூசி", viewSeller:"விற்பவர் சுயவிவரம்",
      memberSince:"உறுப்பினர்", activeAds:"செயலில் உள்ள விளம்பரங்கள்", sellerProfile:"விற்பவர் சுயவிவரம்",
      postAd:"விளம்பரம் இடுக", adType:"விளம்பர வகை", forSale:"விற்பனைக்கு", wanted:"தேவை",
      category:"வகை", title:"தலைப்பு", price:"விலை (₹)", unit:"விலை அலகு",
      unitEach:"ஒன்று", unitKg:"கிலோ", unitTotal:"மொத்தம்", qty:"எண்ணிக்கை",
      description:"விவரம்", descPh:"நிலை, வயது, விற்பனை காரணம்…",
      photos:"புகைப்படங்கள்", photoHint:"குறைந்தது 1 தெளிவான படம் — முழு விலங்கையும் காட்டு",
      wantedPhotoHint:"தேவை விளம்பரங்களுக்கு படம் விருப்பம்", addPhotoBtn:"படம் சேர்", video:"வீடியோ (விருப்பம்)",
      addVideo:"வீடியோ சேர்", locationReq:"இடம்", useGps:"தற்போதைய இருப்பிடம்",
      manualLoc:"கைமுறையாக உள்ளிடு", district:"மாவட்டம்", village:"கிராமம் / வட்டம்",
      next:"அடுத்து", errTitle:"தலைப்பை உள்ளிடவும்", errPrice:"சரியான விலையை உள்ளிடவும்", errDesc:"விவரத்தை உள்ளிடவும்",
      errPhoto:"குறைந்தது ஒரு படத்தைச் சேர்க்கவும்", errLoc:"GPS தேர்வு செய்யவும் அல்லது மாவட்டம் & கிராமத்தை உள்ளிடவும்",
      fixErrors:"குறிக்கப்பட்ட புலங்களைச் சரிசெய்யவும்.",
      previewAd:"உங்கள் விளம்பரத்தை முன்னோட்டம்", previewNote:"சமர்ப்பிக்கும் முன் அனைத்தும் சரியா எனப் பாருங்கள்.",
      photoOk:"முழு விலங்கும் தெரிகிறது, வெட்டப்படவில்லை.", submitApproval:"ஒப்புதலுக்கு சமர்ப்பி",
      saving:"சேமிக்கிறது…", submittedTitle:"ஒப்புதலுக்காக விளம்பரம் அனுப்பப்பட்டது",
      pendingExplain:"உங்கள் விளம்பரம் பரிசீலனையில். எங்கள் குழு ஒப்புதல் அளிக்கும் வரை பொது ஊட்டத்தில் தோன்றாது — பொதுவாக சில மணிநேரத்தில்.",
      goMyListings:"எனது பட்டியல்களுக்கு", backHome:"முகப்புக்கு",
      myListings:"எனது பட்டியல்கள்", tabPending:"நிலுவையில்", tabActive:"செயலில்", tabRejected:"நிராகரிப்பு", tabSold:"விற்றது",
      views:"பார்வைகள்", edit:"திருத்து", markSold:"விற்றதாகக் குறி", del:"நீக்கு", relist:"திருத்தி மீண்டும் அனுப்பு",
      rejReasonLabel:"காரணம்", noneHere:"இங்கே ஒன்றும் இல்லை",
      wantedAds:"தேவை விளம்பரங்கள்", wantedBlurb:"விலங்குகள் & பொருட்களைத் தேடும் வாங்குபவர்கள்.",
      notifications:"அறிவிப்புகள்", markRead:"அனைத்தையும் படித்ததாக", noNotifs:"அறிவிப்புகள் இல்லை",
      nApproved:"விளம்பரம் ஒப்புதல்", nRejected:"விளம்பரம் நிராகரிப்பு", nMessage:"புதிய செய்தி", nNearby:"அருகில் புதியது",
      messages:"செய்திகள்", noChats:"உரையாடல்கள் இல்லை", typeMsg:"செய்தி தட்டச்சு…",
      online:"ஆன்லைனில்", lastSeen:"கடைசியாக", minAgo:"நிமிடம் முன்", hrAgo:"மணி முன்", justNow:"இப்போது",
      myProfile:"எனது சுயவிவரம்", verified:"சரிபார்க்கப்பட்டது", language:"மொழி",
      contactPerms:"தொடர்பு அனுமதிகள்", allowCall:"வாங்குபவர்கள் என்னை அழைக்க அனுமதி",
      allowWa:"WhatsApp அனுமதி", profilePhoto:"சுயவிவரப் படம்", optional:"விருப்பம்",
      settings:"அமைப்புகள்", notifTopics:"அறிவிப்பு வகைகள்", alertRadius:"அறிவிப்பு எல்லை",
      locationHelp:"இருப்பிட அனுமதி உதவி", account:"கணக்கு & தனியுரிமை",
      deleteAccount:"எனது கணக்கை நீக்கு", replayTour:"தொடக்க சுற்றுலாவை மீண்டும்", logout:"வெளியேறு",
      adminMode:"நிர்வாக பயன்முறை (மாதிரி)", adminQueue:"ஒப்புதல் வரிசை", approve:"ஒப்புதல்", reject:"நிராகரி",
      rejectReasonPh:"ஏன் நிராகரிக்கப்படுகிறது? (விற்பவருக்குக் காட்டப்படும்)", submitReject:"நிராகரிப்பை உறுதிப்படுத்து",
      needReason:"காரணத்தை உள்ளிடவும்", noPending:"ஒப்புதலுக்கு விளம்பரங்கள் இல்லை", pending:"நிலுவையில்",
      seller:"விற்பவர்", submitted:"சமர்ப்பிக்கப்பட்டது", quantity:"எண்.",
      navHome:"முகப்பு", navSearch:"தேடு", navSell:"விற்க", navMessages:"செய்திகள்", navProfile:"சுயவிவரம்",
      otpSent:"குறியீடு அனுப்பப்பட்டது (மாதிரி)", approvedToast:"ஒப்புதல் அளிக்கப்பட்டது — இப்போது நேரலையில்",
      rejectedToast:"விளம்பரம் நிராகரிக்கப்பட்டது", soldToast:"விற்றதாகக் குறிக்கப்பட்டது", deletedToast:"நீக்கப்பட்டது",
      postedToast:"ஒப்புதலுக்கு அனுப்பப்பட்டது", locToast:"இருப்பிடம் கண்டறியப்பட்டது", locManualToast:"இருப்பிடம் சேமிக்கப்பட்டது",
      photoAdded:"படம் சேர்க்கப்பட்டது (மாதிரி)", markedRead:"அனைத்தும் படித்ததாக", langToast:"மொழி மாற்றப்பட்டது",
      savedToast:"சேமிக்கப்பட்டது", resetToast:"மாதிரி மீட்டமைக்கப்பட்டது", waToast:"WhatsApp திறக்கிறது…", callToast:"அழைக்கிறது…",
      loginToast:"நம்ம சந்தைக்கு வரவேற்கிறோம்!", selfChat:"இது உங்கள் சொந்த விளம்பரம்."
    }
  };
  var lang = "en";
  function t(k){ var v = T[lang] && T[lang][k]; return (v!=null && v!=="") ? v : (T.en[k]!=null?T.en[k]:k); }
  function cat(k){ var c=catMeta(k); return lang==="ta"?c.ta:c.en; }
  var INR = function(n){ return "₹" + Number(n).toLocaleString("en-IN"); };

  /* ---------- sellers (demo) ---------- */
  var SELLERS = {
    ramesh:{id:"ramesh",name:"Ramesh Kumar",initial:"R",verified:true,online:true,seen:0,call:true,whatsapp:true,number:"+919876543210",since:"Mar 2024",locality:"Alanganallur, Madurai"},
    selvi:{id:"selvi",name:"Selvi Priya",initial:"S",verified:true,online:false,seen:12,call:false,whatsapp:true,number:"+919812345678",since:"Jan 2024",locality:"Melur, Madurai"},
    senthil:{id:"senthil",name:"Senthil Raja",initial:"S",verified:true,online:false,seen:48,call:false,whatsapp:false,number:"",since:"Nov 2023",locality:"Srirangam, Trichy"},
    murugan:{id:"murugan",name:"Murugan P",initial:"M",verified:true,online:true,seen:0,call:true,whatsapp:true,number:"+919845612300",since:"Feb 2024",locality:"Dindigul"},
    arun:{id:"arun",name:"Arun Kumar",initial:"A",verified:true,online:false,seen:130,call:true,whatsapp:false,number:"+919834567890",since:"Mar 2024",locality:"Madurai"}
  };
  function sellerOf(l){
    if(l.ownerObj) return l.ownerObj;          // live mode: real server user
    return l.owner==="me" ? meSeller() : (SELLERS[l.owner]||SELLERS.ramesh);
  }
  function meSeller(){ return {id:"me",name:state.user.name||"You",initial:(state.user.name||"Y")[0].toUpperCase(),verified:false,online:true,seen:0,call:state.user.call,whatsapp:state.user.whatsapp,number:state.user.phone?("+91"+state.user.phone):"",since:"today",locality:state.user.locality}; }

  var GOATS = ["assets/goat-jamunapari.jpg","assets/goat-boer.jpg","assets/goat-kanni.jpg","assets/goat-karuppu.jpg","assets/goat-tellicherry.jpg"];

  /* ---------- state ---------- */
  var state;
  function freshState(){
    return {
      lang:"en", onboarded:false, role:"user", nextId:100,
      user:{phone:"",verified:false,name:"",photo:null,district:"Madurai",village:"Alanganallur",
        locality:"Madurai, Tamil Nadu",coords:null,call:false,whatsapp:false,
        alerts:{cats:["goat"],radius:25,enabled:true}},
      listings:[], convos:[], notifs:[],
      draft:null, pendingPhone:"", otp:null, radius:25, locAllowed:false
    };
  }
  function L(o){
    o.type=o.type||"sale"; o.unit=o.unit||"total"; o.qty=o.qty||1; o.views=o.views||0;
    o.photos=o.photos||[]; o.video=!!o.video; o.rej=o.rej||""; o.specs=o.specs||{};
    o.loc=o.loc||{mode:"manual",district:"Madurai",village:"",locality:"Madurai, Tamil Nadu",km:5};
    o.created=o.created||"today"; return o;
  }

  // One-time cleanup: phones that opened an earlier build still hold seeded
  // demo listings under the old key. Drop every legacy key so nobody keeps
  // seeing fake goats after an update.
  try{
    ["ns_state","ns_state_v1","ns_state_v2","ns_state_v3"].forEach(function(k){
      localStorage.removeItem(k);
    });
  }catch(e){}

  function load(){
    try{ var raw=localStorage.getItem(LS); if(raw){ state=JSON.parse(raw); if(!state.listings) state=freshState(); } else state=freshState(); }
    catch(e){ state=freshState(); }
    lang = state.lang || "en";
  }
  function save(){
    try{
      state.lang=lang;
      localStorage.setItem(LS, JSON.stringify(state));
    }catch(e){
      // A camera photo held in the draft can exceed the ~5 MB localStorage
      // quota. Persist everything EXCEPT the draft images (they stay in
      // memory and still upload) rather than silently saving nothing.
      try{
        var slim=JSON.parse(JSON.stringify(state));
        if(slim.draft) slim.draft.photos=[];
        localStorage.setItem(LS, JSON.stringify(slim));
      }catch(e2){}
    }
  }

  /* ---------- small helpers ---------- */
  var app = function(){ return document.getElementById("app"); };
  var esc = function(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); };
  function media(l, extra){
    var p = l.photos && l.photos[0];
    if(p) return '<div class="media '+(extra||"")+'"><img src="'+p+'" alt="'+esc(l.title)+'" loading="lazy" decoding="async"></div>';
    return '<div class="media '+(extra||"")+'"><span class="noimg">'+catMeta(l.category).e+'</span></div>';
  }
  function presence(s){
    if(s.online) return "🟢 "+t("online");
    var m=s.seen||0; if(m<1) return t("justNow");
    if(m<60) return "⚪ "+t("lastSeen")+" "+m+" "+t("minAgo");
    return "⚪ "+t("lastSeen")+" "+Math.round(m/60)+" "+t("hrAgo");
  }
  var toastTimer;
  function toast(m){ var el=document.getElementById("toast"); el.textContent=m; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer=setTimeout(function(){el.classList.remove("show");},1900); }
  function unreadNotifs(){ return state.notifs.filter(function(n){return n.unread;}).length; }
  function unreadChats(){ return state.convos.reduce(function(a,c){return a+(c.unread||0);},0); }
  function byId(id){ for(var i=0;i<state.listings.length;i++) if(state.listings[i].id===id) return state.listings[i]; return null; }
  function convById(id){ for(var i=0;i<state.convos.length;i++) if(state.convos[i].id===id) return state.convos[i]; return null; }

  /* ---------- appbar + nav ---------- */
  function bar(opts){
    opts=opts||{};
    var left = opts.back ? '<button class="back" data-go="'+opts.back+'" aria-label="Back">←</button>' : (opts.brand?BRAND_SM:"");
    var title = opts.title ? '<div style="font-weight:800;font-size:16px">'+opts.title+'</div>' : "";
    var right="";
    if(opts.lang) right += langPill();
    if(opts.bell){
      var u=unreadNotifs();
      right += '<button class="back bell-wrap" data-go="notifications" aria-label="'+t("notifications")+'" style="font-size:18px">🔔'
        + (u>0?'<span class="bell-badge">'+u+'</span>':"") + '</button>';
    }
    return '<div class="appbar">'+left+title+'<span class="spacer"></span>'+right+'</div>';
  }
  function langPill(){
    return '<span class="lang-pill">'
      + '<button data-setlang="ta" class="'+(lang==="ta"?"active":"")+'">தமிழ்</button>'
      + '<button data-setlang="en" class="'+(lang==="en"?"active":"")+'">EN</button></span>';
  }
  var NAV = [
    {k:"home",go:"home",i:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l9 8h-3v10h-4v-6h-4v6H6V11H3z"/></svg>',l:"navHome",match:["home"]},
    {k:"search",go:"browse",i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>',l:"navSearch",match:["browse","nearby"]},
    {k:"sell",go:"post",sell:true,i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>',l:"navSell",match:["post","preview"]},
    {k:"messages",go:"messages",i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',l:"navMessages",match:["messages","chat"]},
    {k:"profile",go:"myprofile",i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',l:"navProfile",match:["myprofile","settings","mylistings"]}
  ];
  var NAV_ROUTES = ["home","browse","nearby","messages","myprofile"];
  function renderNav(route){
    var nav=document.getElementById("bottomnav");
    if(NAV_ROUTES.indexOf(route)<0){ nav.hidden=true; nav.innerHTML=""; return; }
    nav.hidden=false;
    nav.innerHTML = NAV.map(function(n){
      var active = n.match.indexOf(route)>=0;
      if(n.sell) return '<button class="navbtn sell" data-go="post"><span class="fab">'+n.i+'</span><span>'+t(n.l)+'</span></button>';
      return '<button class="navbtn '+(active?"active":"")+'" data-go="'+n.go+'">'+n.i+'<span>'+t(n.l)+'</span></button>';
    }).join("");
  }

  /* ---------- SCREENS ---------- */
  var S = {};

  S.welcome=function(){
    return '<section class="screen active temple-bg"><div class="pad" style="margin:auto 0">'
      +'<div class="brand"><div class="logo-circle">'+LOGO+'</div>'
      +'<div class="name">NAMMA SANTHAI</div><div class="rule"></div>'
      +'<div class="tagline">'+t("tagline")+'</div></div>'
      +'<p class="sub center" style="margin:18px 4px 22px">'+t("welcomeBlurb")+'</p>'
      +'<label class="sub" style="margin-bottom:8px;display:block;font-weight:600">'+t("chooseLang")+'</label>'
      +'<div class="lang-toggle">'
      +'<button data-setlang="ta" class="'+(lang==="ta"?"active":"")+'">தமிழ் Tamil</button>'
      +'<button data-setlang="en" class="'+(lang==="en"?"active":"")+'">English</button></div>'
      +'<div style="height:16px"></div>'
      +'<button class="btn btn-primary" data-go="phone">'+t("letsBegin")+' →</button>'
      +'<p class="hint center" style="margin-top:14px"><span class="demo-badge">DEMO</span> '+t("trialNote")+'</p>'
      +'</div></section>';
  };

  S.phone=function(){
    var live = !!(window.NS_API && window.NS_API.enabled);
    return '<section class="screen active">'+bar({back:"welcome",brand:true})+'<div class="pad">'
      +'<h1 class="h1">'+t("enterMobile")+'</h1>'
      +'<p class="sub">'+(live?t("noOtpSub"):t("otpSub"))+'</p>'
      +'<div class="field" id="f-phone"><label>'+t("mobileLabel")+' <span class="req">*</span></label>'
      +'<div class="input-group"><span class="cc">🇮🇳 +91</span>'
      +'<input id="phone" type="tel" inputmode="numeric" maxlength="10" placeholder="98765 43210" value="'+esc(state.pendingPhone||"")+'"></div>'
      +'<div class="err-msg">'+t("errPhone")+'</div></div>'
      +(live?'<div class="field"><label>'+t("yourName")+'</label>'
        +'<input class="input" id="signin-name" placeholder="Ramesh Kumar" value="'+esc(state.user.name||"")+'"></div>':"")
      +'<button class="btn btn-primary" id="send-otp">'+(live?t("continue"):t("sendOtp"))+'</button>'
      +(live?'':'<div class="divider">'+t("or")+'</div>'
        +'<button class="btn btn-outline" id="google"><span style="font-weight:800;color:#4285F4">G</span> '+t("google")+'</button>')
      +'<p class="hint center" style="margin-top:16px">🔒 '+t("privacyNote")+'</p>'
      +(live?'<p class="hint center" style="margin-top:8px"><span class="demo-badge">TEST</span> '+t("noOtpNote")+'</p>':"")
      +'</div></section>';
  };

  S.otp=function(){
    return '<section class="screen active">'+bar({back:"phone",brand:true})+'<div class="pad">'
      +'<h1 class="h1">'+t("verifyTitle")+'</h1>'
      +'<p class="sub">'+t("verifySub")+' <b>+91 '+esc(state.pendingPhone)+'</b></p>'
      +'<div class="demo-code"><div class="dc">'+t("demoCodeLabel")+'</div><div class="code" id="demo-code">'+state.otp.code+'</div></div>'
      +'<div class="field" id="f-otp"><div class="otp-row">'
      + [0,1,2,3,4,5].map(function(i){return '<input class="otp-box" data-otp="'+i+'" inputmode="numeric" maxlength="1" aria-label="digit '+(i+1)+'">';}).join("")
      +'</div><div class="err-msg" id="otp-err">'+t("errOtp")+'</div></div>'
      +'<button class="btn btn-primary" id="verify">'+t("verify")+'</button>'
      +'<p class="resend" id="resend"></p>'
      +'<button class="btn btn-ghost" data-go="phone" style="width:100%;margin-top:4px">'+t("editNumber")+'</button>'
      +'</div></section>';
  };

  S.profile=function(){
    return '<section class="screen active">'+bar({back:"otp",brand:true})+'<div class="pad">'
      +'<h1 class="h1">'+t("completeProfile")+'</h1><p class="sub">'+t("profileSub")+'</p>'
      +'<div class="center" style="margin-bottom:18px"><div class="avatar" style="width:84px;height:84px;margin:0 auto;font-size:30px">＋</div>'
      +'<div class="hint">'+t("addPhoto")+'</div></div>'
      +'<div class="field" id="f-name"><label>'+t("yourName")+' <span class="req">*</span></label>'
      +'<div class="input-icon"><span class="ic">👤</span><input class="input" id="pname" placeholder="Ramesh Kumar" value="'+esc(state.user.name)+'"></div>'
      +'<div class="err-msg">'+t("errName")+'</div></div>'
      +'<div class="field"><label>'+t("yourLocation")+'</label>'
      +'<div class="input-icon"><span class="ic">📍</span><input class="input" id="ploc" value="'+esc(state.user.locality)+'"></div></div>'
      +'<p class="hint"><span class="demo-badge">DEMO</span> '+t("demoUnverified")+'</p>'
      +'<button class="btn btn-primary" id="save-profile" style="margin-top:8px">'+t("continue")+'</button>'
      +'</div></section>';
  };

  function card(l){
    var s=sellerOf(l);
    return '<article class="card" data-open="'+l.id+'"><div class="thumb">'+media(l)
      +(l.type==="wanted"?'<span class="tag" style="background:var(--gold-soft);color:#7a5a00">'+t("wanted")+'</span>':(l.views>120?'<span class="tag">★</span>':""))
      +'<button class="fav" aria-label="Save" data-noop>🤍</button></div>'
      +'<div class="body"><div class="title">'+esc(l.title)+'</div>'
      +'<div class="price">'+INR(l.price)+'</div>'
      +(l.owner==="me"&&l.status!=="active"
        ? '<div class="status '+l.status+'" style="margin:2px 0 4px">'+t("tab"+l.status.charAt(0).toUpperCase()+l.status.slice(1))+'</div>' : "")
      +'<div class="loc">📍 '+esc(l.loc.locality)+(state.locAllowed?' · '+l.loc.km+'km':"")+'</div></div></article>';
  }

  function visibleFeed(){
    return state.listings.filter(function(l){
      if(l.status==="active") return true;
      // your own ad is always visible to you, badged, even before approval
      return l.owner==="me" && (l.status==="pending"||l.status==="rejected");
    });
  }
  S.home=function(){
    var feat = visibleFeed().filter(function(l){return l.type==="sale";});
    return '<section class="screen active">'+bar({brand:true,lang:true,bell:true})
      +'<div class="searchbar">🔍 <input id="home-search" placeholder="'+t("searchPh")+'" aria-label="Search"></div>'
      +'<div class="chips" id="home-chips">'
      + CATS.slice(0,6).map(function(c,i){return '<button class="chip'+(i===0?" active":"")+'" data-chip="'+c.k+'"><span class="e">'+c.e+'</span>'+cat(c.k)+'</button>';}).join("")
      +'<button class="chip" data-go="browse"><span class="e">⋯</span>'+t("seeAll")+'</button></div>'
      +'<div class="safety-strip"><span class="si">🛡️</span><span>'+t("safety")+'</span></div>'
      +'<div class="section-head"><h2>'+t("featured")+'</h2>'
      +(feat.length?'<button class="btn-ghost" data-go="browse">'+t("seeAll")+' →</button>':"")+'</div>'
      +(feat.length
        ? '<div class="grid2">'+feat.map(card).join("")+'</div>'
        : '<div class="empty"><div class="ee">🐐</div><p>'+t("emptyFeed")+'</p>'
          +'<button class="btn btn-primary" data-go="post" style="width:auto;margin-top:14px">+ '+t("postAd")+'</button></div>')
      +'<div style="height:14px"></div></section>';
  };

  S.browse=function(p){
    p=p||{}; var selCat=p.cat||state.browseCat||"all"; state.browseCat=selCat;
    var q=(state.browseQ||"").toLowerCase();
    var items=visibleFeed().filter(function(l){
      if(selCat!=="all" && l.category!==selCat) return false;
      if(q && esc(l.title).toLowerCase().indexOf(q)<0) return false;
      return true;
    });
    var opts='<option value="all">'+t("allCats")+'</option>'+CATS.map(function(c){return '<option value="'+c.k+'"'+(c.k===selCat?" selected":"")+'>'+c.e+' '+cat(c.k)+'</option>';}).join("");
    var body = items.length
      ? '<div class="grid2">'+items.map(card).join("")+'</div>'
      : '<div class="empty"><div class="ee">🔍</div><p>'+t("noResults")+'</p><button class="btn btn-outline sm" id="reset-filter" style="margin-top:12px">'+t("tryReset")+'</button></div>';
    return '<section class="screen active">'+bar({back:"home",title:t("browse"),lang:true,bell:true})
      +'<div class="searchbar">🔍 <input id="browse-search" placeholder="'+t("searchPh")+'" value="'+esc(state.browseQ||"")+'"></div>'
      +'<div class="filterbar"><select class="input" id="cat-filter">'+opts+'</select>'
      +'<button class="btn btn-outline sm" data-go="nearby" style="width:auto">📍 '+t("goatsNearYou")+'</button></div>'
      +body+'<div style="height:14px"></div></section>';
  };

  S.nearby=function(){
    var r=state.radius;
    var items=visibleFeed().filter(function(l){return l.type==="sale"&&(!state.locAllowed||l.loc.km<=r);})
      .sort(function(a,b){return a.loc.km-b.loc.km;});
    var perm = state.locAllowed ? "" :
      '<div class="perm" id="perm"><p><b>'+t("permTitle")+'</b><br>'+t("permMsg")+'</p>'
      +'<div class="row"><button class="btn sm btn-outline" id="perm-manual">'+t("enterManual")+'</button>'
      +'<button class="btn sm btn-primary" id="perm-allow">'+t("allowLoc")+'</button></div></div>';
    var radrow = state.locAllowed ? '<div class="radius-row">'
      + [5,10,25,50].map(function(k){return '<button class="rchip'+(k===r?" active":"")+'" data-radius="'+k+'">'+t("withinKm")+' '+k+' km</button>';}).join("")
      +'</div>' : "";
    var list = items.length ? '<div class="list">'+items.map(function(l){
      return '<article class="lrow" data-open="'+l.id+'"><div class="lthumb">'+media(l)+'</div>'
        +'<div class="lbody"><div class="title">'+esc(l.title)+'</div><div class="price">'+INR(l.price)+'</div>'
        +'<div class="meta"><span>📍 '+esc(l.loc.locality)+'</span>'+(state.locAllowed?'<span>'+l.loc.km+' '+t("kmAway")+'</span>':"")+'</div></div></article>';
    }).join("")+'</div>' : '<div class="empty"><div class="ee">📍</div><p>'+t("noResults")+'</p></div>';
    return '<section class="screen active">'+bar({back:"home",title:t("goatsNearYou"),lang:true,bell:true})
      +'<div style="padding:10px 16px 0;font-size:13px;color:var(--ink-soft)">📍 '+esc(state.user.locality)+' · <span data-go="myprofile" style="text-decoration:underline;cursor:pointer">'+t("change")+'</span></div>'
      +perm+radrow+list+'<div style="height:12px"></div></section>';
  };

  S.listing=function(p){
    var l=byId(p.id); if(!l) return S.home();
    l.views++; save();
    var s=sellerOf(l); var isMine=l.owner==="me";
    var sp=l.specs||{}; var specCells="";
    function spec(k,v){ return v?'<div class="s"><div class="k">'+t(k)+'</div><div class="v">'+esc(v)+'</div></div>':""; }
    specCells = spec("specBreed",sp.breed)+spec("specSex",sp.sex?t(sp.sex.toLowerCase())||sp.sex:"")+spec("specAge",sp.age)+spec("specWeight",sp.weight);
    var contact;
    if(isMine){
      contact='<div class="contact-note">'+t("selfChat")+'</div>';
    }else{
      var callBtn = s.call ? '<button class="btn btn-call" data-call="'+l.id+'">📞 '+t("call")+'</button>'
        : '<button class="btn btn-outline" disabled>📞 '+t("call")+'</button>';
      var waBtn = s.whatsapp ? '<button class="btn btn-wa" data-wa="'+l.id+'"> '+t("whatsapp")+'</button>'
        : '<button class="btn btn-outline" disabled> '+t("whatsapp")+'</button>';
      var reason = (!s.call||!s.whatsapp) ? '<div class="disabled-reason">'+(!s.call?t("noCall"):"")+(!s.call&&!s.whatsapp?" · ":"")+(!s.whatsapp?t("noWa"):"")+'</div>' : "";
      contact = reason + '<div class="contact-note">'+t("contactShareNote")+'</div>'
        +'<div class="contact-3"><button class="btn btn-primary" data-msg="'+l.id+'">💬 '+t("message")+'</button>'+callBtn+waBtn+'</div>';
    }
    return '<section class="screen active" style="padding-bottom:0">'
      +'<div class="detail-hero"><div class="topbtns"><button class="cbtn" data-go="home" aria-label="Back">←</button>'
      +'<div class="row" style="gap:8px"><button class="cbtn" data-noop aria-label="Save">🤍</button><button class="cbtn" data-share="'+l.id+'" aria-label="Share">↗</button></div></div>'
      + media(l) + (l.photos&&l.photos.length?'<span class="count">1 / '+l.photos.length+'</span>':"")+'</div>'
      +'<div class="detail-body" style="padding-bottom:'+(isMine?"40px":"150px")+'">'
      +(l.type==="wanted"?'<span class="type-badge">'+t("wanted")+'</span>':"")
      +'<div class="price">'+INR(l.price)+(l.unit&&l.unit!=="total"?' / '+t(l.unit==="kg"?"unitKg":"unitEach"):"")+'</div>'
      +'<div class="dtitle">'+esc(l.title)+'</div>'
      +'<div class="loc">📍 '+esc(l.loc.locality)+(state.locAllowed&&l.loc.km?' · '+l.loc.km+' '+t("kmAway"):"")+'</div>'
      +(specCells?'<div class="spec">'+specCells+'</div>':"")
      +(sp.health?'<div class="s" style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:6px"><div class="k" style="font-size:11px;color:var(--ink-soft)">'+t("specHealth")+'</div><div class="v" style="font-size:14px;font-weight:700">✅ '+esc(sp.health)+'</div></div>':"")
      +'<h3 style="font-size:15px;margin:14px 0 6px">'+t("descLabel")+'</h3><p class="desc">'+esc(l.desc)+'</p>'
      +'<div class="seller" data-seller="'+s.id+'"><div class="avatar">'+s.initial+'</div>'
      +'<div><div class="sname">'+esc(s.name)+(s.verified?' <span class="verified">✔</span>':"")+'</div>'
      +'<div class="ssince">'+t("memberSince")+' '+s.since+'</div></div>'
      +'<span class="chev" style="margin-left:auto;color:var(--ink-soft)">›</span></div>'
      +'<div class="safety"><span class="si">🛡️</span><span>'+t("safety")+'</span></div>'
      +'</div>'+contact+'</section>';
  };

  S.seller=function(p){
    var s = p.id==="me"?meSeller():(SELLERS[p.id]||SELLERS.ramesh);
    var ads = state.listings.filter(function(l){return l.owner===p.id&&l.status==="active";});
    return '<section class="screen active">'+bar({back:"home",title:t("sellerProfile"),lang:true})
      +'<div class="seller-hero"><div class="avatar">'+s.initial+'</div>'
      +'<div class="pname" style="font-size:18px;font-weight:800">'+esc(s.name)+(s.verified?' <span class="verified">✔</span>':"")+'</div>'
      +'<div style="font-size:13px;color:#cfe8d8">📍 '+esc(s.locality)+'</div></div>'
      +'<div class="seller-stats"><div class="st"><div class="n">'+ads.length+'</div><div class="l">'+t("activeAds")+'</div></div>'
      +'<div class="st"><div class="n">'+s.since+'</div><div class="l">'+t("memberSince")+'</div></div>'
      +'<div class="st"><div class="n">'+(s.verified?"✔":"—")+'</div><div class="l">'+t("verified")+'</div></div></div>'
      +'<div class="grid2" style="padding-top:14px">'+ads.map(card).join("")+'</div></section>';
  };

  function draftNew(){ return {type:"sale",category:"goat",title:"",price:"",unit:"total",qty:1,desc:"",photos:[],video:false,loc:{mode:"",district:"",village:""},editId:null}; }
  S.post=function(){
    if(!state.draft) state.draft=draftNew();
    var d=state.draft;
    var catOpts=CATS.map(function(c){return '<option value="'+c.k+'"'+(c.k===d.category?" selected":"")+'>'+c.e+' '+cat(c.k)+'</option>';}).join("");
    var photoSlots=d.photos.map(function(ph,i){return '<button class="photo-slot filled" data-rmphoto="'+i+'"><img src="'+ph+'" style="width:100%;height:100%;object-fit:cover" alt=""></button>';}).join("")
      +'<button class="photo-slot" id="add-photo">＋</button>';
    var isWanted=d.type==="wanted";
    return '<section class="screen active">'+bar({back:"home",brand:true})+'<div class="pad">'
      +'<h1 class="h1" style="font-size:22px">'+(d.editId?t("edit"):t("postAd"))+'</h1>'
      +'<div class="form-error" id="post-form-error">'+t("fixErrors")+'</div>'
      +'<div class="field"><label>'+t("adType")+'</label><div class="seg" id="type-seg">'
      +'<button class="'+(d.type==="sale"?"active":"")+'" data-type="sale"><span class="e">🏷️</span>'+t("forSale")+'</button>'
      +'<button class="'+(d.type==="wanted"?"active":"")+'" data-type="wanted"><span class="e">🔎</span>'+t("wanted")+'</button></div></div>'
      +'<div class="field"><label>'+t("category")+' <span class="req">*</span></label><select class="input" id="d-cat">'+catOpts+'</select></div>'
      +'<div class="field" id="f-title"><label>'+t("title")+' <span class="req">*</span></label><input class="input" id="d-title" placeholder="e.g. Jamunapari Goat (Male)" value="'+esc(d.title)+'"><div class="err-msg">'+t("errTitle")+'</div></div>'
      +'<div class="row" style="gap:10px;align-items:flex-start"><div class="field grow" id="f-price"><label>'+t("price")+' <span class="req">*</span></label><input class="input" id="d-price" type="tel" inputmode="numeric" placeholder="25000" value="'+esc(d.price)+'"><div class="err-msg">'+t("errPrice")+'</div></div>'
      +'<div class="field" style="width:120px"><label>'+t("unit")+'</label><select class="input" id="d-unit"><option value="total"'+(d.unit==="total"?" selected":"")+'>'+t("unitTotal")+'</option><option value="each"'+(d.unit==="each"?" selected":"")+'>'+t("unitEach")+'</option><option value="kg"'+(d.unit==="kg"?" selected":"")+'>'+t("unitKg")+'</option></select></div></div>'
      +'<div class="field" id="f-desc"><label>'+t("description")+' <span class="req">*</span></label><textarea class="input" id="d-desc" rows="3" placeholder="'+t("descPh")+'">'+esc(d.desc)+'</textarea><div class="err-msg">'+t("errDesc")+'</div></div>'
      +'<div class="field" id="f-photo"><label>'+t("photos")+(isWanted?"":' <span class="req">*</span>')+' <span class="hint">('+(isWanted?t("wantedPhotoHint"):t("photoHint"))+')</span></label>'
      +'<div class="photo-add" id="photo-add">'+photoSlots+'</div>'
      +'<input type="file" id="photo-file" accept="image/*" multiple hidden>'
      +'<div class="err-msg">'+t("errPhoto")+'</div>'
      +'<div class="hint">'+t("photoHint")+'</div></div>'
      +'<div class="field"><label>'+t("video")+'</label><button class="btn btn-outline" id="add-video" style="justify-content:flex-start">🎬 '+t("addVideo")+'</button></div>'
      +'<div class="field" id="f-loc"><label>'+t("locationReq")+' <span class="req">*</span></label>'
      +'<div class="loc-pick"><button class="btn '+(d.loc.mode==="gps"?"btn-primary":"btn-outline")+'" id="d-gps">📍 '+t("useGps")+'</button>'
      +'<button class="btn '+(d.loc.mode==="manual"?"btn-primary":"btn-outline")+'" id="d-manual">'+t("manualLoc")+'</button></div>'
      +'<div id="manual-fields" style="margin-top:8px;'+(d.loc.mode==="manual"?"":"display:none")+'">'
      +'<input class="input" id="d-district" placeholder="'+t("district")+'" value="'+esc(d.loc.district)+'" style="margin-bottom:8px">'
      +'<input class="input" id="d-village" placeholder="'+t("village")+'" value="'+esc(d.loc.village)+'"></div>'
      +'<div id="gps-ok" class="hint" style="color:var(--green);'+(d.loc.mode==="gps"?"":"display:none")+'">✓ '+t("locToast")+'</div>'
      +'<div class="err-msg">'+t("errLoc")+'</div></div>'
      +'<button class="btn btn-primary" id="post-next">'+t("next")+'</button>'
      +'</div></section>';
  };

  S.preview=function(){
    var d=state.draft; if(!d) return S.post();
    var ph = d.photos[0];
    return '<section class="screen active">'+bar({back:"post",brand:true})+'<div class="pad">'
      +'<h1 class="h1" style="font-size:22px">'+t("previewAd")+'</h1><p class="sub">'+t("previewNote")+'</p>'
      +'<div class="detail-hero" style="border-radius:14px;overflow:hidden;box-shadow:var(--shadow);aspect-ratio:4/3">'
      +(ph?'<div class="media"><img src="'+ph+'" alt=""><span class="demo-tag">YOUR PHOTO</span></div>':'<div class="media"><span class="noimg">'+catMeta(d.category).e+'</span></div>')+'</div>'
      +'<div class="check-list" style="margin-top:14px">'
      + (ph?'<div class="check"><span class="ok">✓</span><p><b>'+t("photoOk")+'</b></p></div>':"")
      +'<div class="check"><span class="ok">✓</span><p><b>'+esc(d.title)+'</b> · '+INR(d.price||0)+'<br><small>'+cat(d.category)+' · '+esc(d.loc.mode==="gps"?t("useGps"):(d.loc.village||d.loc.district||state.user.locality))+'</small></p></div>'
      +'</div>'
      +'<button class="btn btn-primary" id="submit-ad">'+t("submitApproval")+'</button>'
      +'</div></section>';
  };

  S.success=function(){
    return '<section class="screen active"><div class="success-wrap">'
      +'<div class="success-ring"><span class="clock">⏳</span></div>'
      +'<h2>'+(state.postedLive?t("liveTitle"):t("submittedTitle"))+'</h2>'
      +'<div class="pending-card"><h3>🟢 '+(state.postedLive?t("liveNow"):t("tabPending"))+'</h3>'
      +'<p style="margin:0;font-size:13px;color:#5a4a16">'+(state.postedLive?t("liveExplain"):t("pendingExplain"))+'</p></div>'
      +'<button class="btn btn-primary" data-go="mylistings">'+t("goMyListings")+'</button>'
      +'<button class="btn btn-ghost" data-go="home" style="width:100%">'+t("backHome")+'</button>'
      +'</div></section>';
  };

  S.mylistings=function(p){
    var tab=(p&&p.tab)||state.myTab||"active"; state.myTab=tab;
    var mine=state.listings.filter(function(l){return l.owner==="me"&&l.status===tab;});
    var counts={pending:0,active:0,rejected:0,sold:0};
    state.listings.forEach(function(l){ if(l.owner==="me"&&counts[l.status]!=null) counts[l.status]++; });
    var tabs=[["active","tabActive"],["pending","tabPending"],["rejected","tabRejected"],["sold","tabSold"]];
    var body = mine.length ? '<div class="mine">'+mine.map(function(m){
      var acts="";
      if(m.status==="active") acts='<div class="mactions"><button class="btn sm btn-outline" data-edit="'+m.id+'">✎ '+t("edit")+'</button><button class="btn sm btn-gold" data-sold="'+m.id+'">✓ '+t("markSold")+'</button><button class="btn sm btn-danger-outline" data-del="'+m.id+'">🗑</button></div>';
      else if(m.status==="rejected") acts='<div style="font-size:12px;color:var(--danger);margin:6px 0">'+t("rejReasonLabel")+': '+esc(m.rej)+'</div><div class="mactions"><button class="btn sm btn-primary" data-edit="'+m.id+'">'+t("relist")+'</button></div>';
      else if(m.status==="pending") acts='<div class="mactions"><button class="btn sm btn-outline" data-edit="'+m.id+'">✎ '+t("edit")+'</button></div>';
      return '<div class="mcard"><div class="mthumb">'+media(m)+(m.status==="sold"?'<span class="sold-badge">'+t("tabSold")+'</span>':"")+'</div>'
        +'<div class="mbody"><div class="mtitle">'+esc(m.title)+' <span class="status '+m.status+'">'+t("tab"+m.status.charAt(0).toUpperCase()+m.status.slice(1))+'</span></div>'
        +'<div class="mprice">'+INR(m.price)+'</div><div class="mviews">👁 '+m.views+' '+t("views")+'</div>'+acts+'</div></div>';
    }).join("")+'</div>' : '<div class="empty"><div class="ee">📋</div><p>'+t("noneHere")+'</p></div>';
    return '<section class="screen active">'+bar({back:"home",title:t("myListings"),lang:true})
      +'<div class="tabbar-sub">'+tabs.map(function(x){return '<button class="'+(tab===x[0]?"active":"")+'" data-mytab="'+x[0]+'">'+t(x[1])+' ('+counts[x[0]]+')</button>';}).join("")+'</div>'
      +body+'</section>';
  };

  S.notifications=function(){
    var body = state.notifs.length ? '<div class="notifs">'+state.notifs.map(function(n){
      var ic = n.type==="approved"?"ok":n.type==="message"?"msg":"goat";
      var icon = n.type==="approved"?"✅":n.type==="rejected"?"⚠️":n.type==="message"?"💬":"🐐";
      var title = n.type==="approved"?t("nApproved"):n.type==="rejected"?t("nRejected"):n.type==="message"?t("nMessage"):t("nNearby");
      return '<div class="notif '+(n.unread?"unread":"")+'" data-notif="'+n.id+'"><div class="nic '+ic+'">'+icon+'</div>'
        +'<div class="nbody"><div class="nt">'+title+'</div><div class="nd">'+(n.extra?n.extra[lang]:"")+'</div><div class="ntime">'+n.time[lang]+'</div></div>'
        +(n.unread?'<span class="dot"></span>':"")+'</div>';
    }).join("")+'</div>' : '<div class="empty"><div class="ee">🔔</div><p>'+t("noNotifs")+'</p></div>';
    return '<section class="screen active">'+bar({back:"home",title:t("notifications"),lang:true})
      +'<div style="display:flex;justify-content:flex-end;padding:8px 16px 0"><button class="btn-ghost sm" id="mark-read">'+t("markRead")+'</button></div>'
      +body+'</section>';
  };

  S.messages=function(){
    var body = state.convos.length ? '<div class="threads">'+state.convos.map(function(c){
      var s=c.other||SELLERS[c.withKey]||{name:"User",initial:"U"}; var l=byId(c.listing);
      var last=c.msgs[c.msgs.length-1];
      return '<div class="thread" data-chat="'+c.id+'"><div class="avatar">'+s.initial+'</div>'
        +'<div class="tinfo"><div class="tname">'+esc(s.name)+'<span class="ttime">'+(last?last.t:"")+'</span></div>'
        +'<div class="tlast">'+(last?esc(last[lang]||last.en):"")+'</div>'
        +'<div class="tsub">🐐 '+(c.sub?esc(c.sub):(l?esc(l.title)+' · '+INR(l.price):""))+'</div></div>'
        +(c.unread?'<span class="badge-count">'+c.unread+'</span>':"")+'</div>';
    }).join("")+'</div>' : '<div class="empty"><div class="ee">💬</div><p>'+t("noChats")+'</p></div>';
    return '<section class="screen active">'+bar({brand:true,title:t("messages"),lang:true})+body+'</section>';
  };

  S.chat=function(p){
    var c=convById(p.id); if(!c) return S.messages();
    c.unread=0; save();
    var s=c.other||SELLERS[c.withKey]||{name:"User",initial:"U",online:false,seen:5}; var l=byId(c.listing);
    return '<section class="screen active" style="padding-bottom:0">'
      +'<div class="appbar"><button class="back" data-go="messages" aria-label="Back">←</button>'
      +'<div class="chat-head"><div class="avatar">'+s.initial+'</div>'
      +'<div><div class="ch-name">'+esc(s.name)+'</div><div class="ch-status">'+presence(s)+'</div></div></div></div>'
      +(l?'<div class="chat-ctx" data-open="'+l.id+'"><div class="media" style="width:34px;height:34px;border-radius:8px;flex:0 0 34px">'+(l.photos[0]?'<img src="'+l.photos[0]+'" alt="">':catMeta(l.category).e)+'</div>'
      +'<div><div class="cc-t">'+esc(l.title)+'</div><div class="cc-p">'+INR(l.price)+'</div></div></div>':"")
      +'<div class="chat-body" id="chat-body">'+c.msgs.map(function(m){return '<div class="bubble '+m.who+'">'+esc(m[lang]||m.en)+'<span class="bt">'+m.t+'</span></div>';}).join("")+'</div>'
      +'<div class="chat-input"><input id="chat-text" placeholder="'+t("typeMsg")+'" aria-label="'+t("typeMsg")+'"><button class="send" id="chat-send" data-cid="'+c.id+'" aria-label="Send">➤</button></div>'
      +'</section>';
  };

  S.myprofile=function(){
    var u=state.user;
    return '<section class="screen active">'+bar({back:"home",title:t("myProfile"),lang:true})
      +'<div class="profile-top"><div class="avatar">'+((u.name||"Y")[0].toUpperCase())+'</div>'
      +'<div><div class="pname">'+esc(u.name||"You")+'</div>'
      +'<div class="pnum">📞 +91 '+esc(u.phone||"—")+' · <span class="demo-badge">'+t("demoUnverified")+'</span></div></div></div>'
      +'<div class="prow"><div class="pic">🌐</div><div class="pl"><div class="plt">'+t("language")+'</div></div>'+langPill()+'</div>'
      +'<div class="prow" data-go="mylistings"><div class="pic">📋</div><div class="pl"><div class="plt">'+t("myListings")+'</div></div><span class="chev">›</span></div>'
      +'<div class="set-group-title">'+t("contactPerms")+'</div>'
      +'<div class="prow"><div class="pic">📞</div><div class="pl"><div class="plt">'+t("allowCall")+'</div></div><button class="switch '+(u.call?"on":"")+'" data-toggle="call" role="switch" aria-checked="'+u.call+'" aria-label="'+t("allowCall")+'"></button></div>'
      +'<div class="prow"><div class="pic">💬</div><div class="pl"><div class="plt">'+t("allowWa")+'</div></div><button class="switch '+(u.whatsapp?"on":"")+'" data-toggle="whatsapp" role="switch" aria-checked="'+u.whatsapp+'" aria-label="'+t("allowWa")+'"></button></div>'
      +'<div class="prow" data-go="settings"><div class="pic">⚙️</div><div class="pl"><div class="plt">'+t("settings")+'</div></div><span class="chev">›</span></div>'
      +'<div class="pad"><button class="btn btn-danger-outline" id="logout">'+t("logout")+'</button></div></section>';
  };

  S.settings=function(){
    var u=state.user;
    var topics=CATS.slice(0,6).map(function(c){
      var on=u.alerts.cats.indexOf(c.k)>=0;
      return '<div class="topic"><span class="e">'+c.e+'</span><span class="tn">'+cat(c.k)+'</span>'
        +'<button class="switch '+(on?"on":"")+'" data-topic="'+c.k+'" role="switch" aria-checked="'+on+'" aria-label="'+cat(c.k)+'"></button></div>';
    }).join("");
    return '<section class="screen active">'+bar({back:"myprofile",title:t("settings"),lang:true})
      +'<div class="prow"><div class="pic">🌐</div><div class="pl"><div class="plt">'+t("language")+'</div></div>'+langPill()+'</div>'
      +'<div class="prow" id="notif-perm-row"><div class="pic">🔔</div><div class="pl">'
      +'<div class="plt">'+t("notifAskTitle")+'</div>'
      +'<div class="pls">'+(notifState()==="granted"?("✔ "+t("notifOn"))
          :notifState()==="denied"?t("notifBlocked"):t("notifAskSub"))+'</div></div>'
      +(notifState()==="default"?'<button class="btn sm btn-primary" id="notif-allow-2" style="width:auto">'+t("notifAllow")+'</button>':"")
      +(notifState()==="granted"?'<button class="btn sm btn-outline" id="notif-test" style="width:auto">'+t("notifTest")+'</button>':"")
      +'</div>'
      +'<div class="set-group-title">'+t("notifTopics")+'</div>'+topics
      +'<div class="set-group-title">'+t("alertRadius")+'</div>'
      +'<div class="radius-row" style="padding:10px 16px">'+[5,10,25,50].map(function(k){return '<button class="rchip'+(u.alerts.radius===k?" active":"")+'" data-setradius="'+k+'">'+k+' km</button>';}).join("")+'</div>'
      +'<div class="set-group-title">'+t("account")+'</div>'
      + (LIVE
          // Server decides. A local switch here would be a lie: the API returns
          // 403 no matter what the phone thinks, which is what made "I gave
          // myself admin" silently fail.
          ? '<div class="prow"><div class="pic">🛡️</div><div class="pl"><div class="plt">'+t("adminMode")+'</div>'
            +'<div class="pls">'+(state.role==="admin"?("✔ "+t("verified")):t("adminByNumber"))+'</div></div></div>'
          : '<div class="prow" id="admin-row"><div class="pic">🛡️</div><div class="pl"><div class="plt">'+t("adminMode")+'</div><div class="pls"></div></div><button class="switch '+(state.role==="admin"?"on":"")+'" data-admin role="switch" aria-checked="'+(state.role==="admin")+'"></button></div>')
      + (state.role==="admin"?'<div class="prow" data-go="admin"><div class="pic">📥</div><div class="pl"><div class="plt">'+t("adminQueue")+'</div></div><span class="chev">›</span></div>':"")
      +'<div class="prow" id="loc-help"><div class="pic">📍</div><div class="pl"><div class="plt">'+t("locationHelp")+'</div></div><span class="chev">›</span></div>'
      +'<div class="prow" id="replay"><div class="pic">🔄</div><div class="pl"><div class="plt">'+t("replayTour")+'</div></div><span class="chev">›</span></div>'
      +'<div class="prow" id="del-account"><div class="pic">🗑️</div><div class="pl"><div class="plt" style="color:var(--danger)">'+t("deleteAccount")+'</div></div><span class="chev">›</span></div>'
      +'</section>';
  };

  S.admin=function(){
    var pend=state.listings.filter(function(l){return l.status==="pending";});
    var body = pend.length ? pend.map(function(l){
      var s=sellerOf(l);
      return '<div class="admin-card"><div class="amedia">'+media(l)+'</div><div class="abody">'
        +'<div class="arow"><span class="k">'+t("title")+'</span><b>'+esc(l.title)+'</b></div>'
        +'<div class="arow"><span class="k">'+t("price")+'</span><b>'+INR(l.price)+'</b></div>'
        +'<div class="arow"><span class="k">'+t("category")+'</span><span>'+cat(l.category)+'</span></div>'
        +'<div class="arow"><span class="k">'+t("seller")+'</span><span>'+esc(s.name)+'</span></div>'
        +'<div class="arow"><span class="k">'+t("locationReq")+'</span><span>'+esc(l.loc.locality)+'</span></div>'
        +'<p class="desc" style="font-size:13px;margin:6px 0 0">'+esc(l.desc)+'</p></div>'
        +'<div class="admin-actions"><button class="btn btn-primary sm" style="flex:1" data-approve="'+l.id+'">✓ '+t("approve")+'</button>'
        +'<button class="btn btn-danger-outline sm" style="flex:1" data-reject="'+l.id+'">✕ '+t("reject")+'</button></div>'
        +'<div class="reject-reason" id="rr-'+l.id+'"><textarea class="input" placeholder="'+t("rejectReasonPh")+'" rows="2"></textarea>'
        +'<button class="btn btn-danger-outline sm" style="width:100%;margin-top:8px" data-confirm-reject="'+l.id+'">'+t("submitReject")+'</button></div></div>';
    }).join("") : '<div class="empty"><div class="ee">✅</div><p>'+t("noPending")+'</p></div>';
    return '<section class="screen active">'+bar({back:"settings",title:t("adminQueue")+" ("+pend.length+")",lang:true})
      +'<div style="padding:10px 16px 0;font-size:12px;color:var(--ink-soft)"><span class="demo-badge">DEMO</span> Server-enforced admin role is a production feature.</div>'
      +body+'<div style="height:14px"></div></section>';
  };

  /* ---------- router ---------- */
  var route="welcome", params={};
  function go(r, p){
    route=r; params=p||{};
    render();
    window.scrollTo(0,0);
    var ap=app(); ap.scrollTop=0;
  }
  function render(){
    document.documentElement.lang=lang;
    var fn=S[route]||S.home;
    app().innerHTML = fn(params);
    renderNav(route);
    wire();
    save();
  }

  /* ---------- OTP timer ---------- */
  var resendTimer=null;
  function startResend(){
    clearInterval(resendTimer);
    var left=30;
    var elu=document.getElementById("resend"); if(!elu) return;
    function tick(){
      var e=document.getElementById("resend"); if(!e){clearInterval(resendTimer);return;}
      if(left>0){ e.innerHTML=t("resendIn")+" "+left+"s"; left--; }
      else { e.innerHTML='<b id="resend-now">'+t("resendNow")+'</b>'; clearInterval(resendTimer); }
    }
    tick(); resendTimer=setInterval(tick,1000);
  }
  function genOtp(){ var c=""; for(var i=0;i<6;i++) c+= (i*7+3+(state.pendingPhone.charCodeAt(i%state.pendingPhone.length)||0))%10; return c.slice(0,6); }

  /* ---------- per-screen wiring ---------- */
  function wire(){
    // generic data-go handled by delegation; here wire inputs per screen
    if(route==="phone"){
      var ph=document.getElementById("phone");
      ph.addEventListener("input",function(){ this.value=this.value.replace(/\D/g,""); });
      document.getElementById("send-otp").addEventListener("click",function(){
        var v=ph.value.trim();
        if(!/^[6-9]\d{9}$/.test(v)){ document.getElementById("f-phone").classList.add("invalid"); return; }
        // LIVE: number IS the login. No OTP, no password.
        if(API && API.enabled){
          var nm=(document.getElementById("signin-name")||{}).value||"";
          var btn=this; btn.disabled=true; btn.textContent=t("saving");
          API.signin(v,nm.trim()).then(function(r){
            API.setToken(r.token); startLive(r.user);
            toast(t("loginToast"));
            go(r.user.name ? "home" : "profile");
            setTimeout(function(){ maybeAskNotifications(); startNotifPolling(); subscribePush(); }, 900);
          }).catch(function(e){ btn.disabled=false; btn.textContent=t("continue"); apiFail(e); });
          return;
        }
        state.pendingPhone=v; state.otp={code:genOtp(),attempts:0}; save();
        toast(t("otpSent")); go("otp");
      });
      document.getElementById("google").addEventListener("click",function(){ state.pendingPhone="9999900000"; state.otp={code:genOtp(),attempts:0}; go("profile"); });
    }
    if(route==="otp"){
      var boxes=[].slice.call(document.querySelectorAll("[data-otp]"));
      boxes.forEach(function(b,i){
        b.addEventListener("input",function(){ this.value=this.value.replace(/\D/g,""); if(this.value&&boxes[i+1]) boxes[i+1].focus(); });
        b.addEventListener("keydown",function(e){ if(e.key==="Backspace"&&!this.value&&boxes[i-1]) boxes[i-1].focus(); });
      });
      boxes[0] && boxes[0].focus();
      document.getElementById("verify").addEventListener("click",function(){
        var val=boxes.map(function(b){return b.value;}).join("");
        var f=document.getElementById("f-otp"), err=document.getElementById("otp-err");
        if(val===state.otp.code){ state.otp=null; go("profile"); return; }
        state.otp.attempts++;
        f.classList.add("invalid");
        err.textContent = state.otp.attempts>=3 ? t("errOtpAttempts") : t("errOtp");
      });
      startResend();
      document.addEventListener("click",resendDelegate);
    } else { document.removeEventListener("click",resendDelegate); }
    if(route==="profile"){
      document.getElementById("save-profile").addEventListener("click",function(){
        var n=document.getElementById("pname").value.trim();
        if(!n){ document.getElementById("f-name").classList.add("invalid"); return; }
        var loc=document.getElementById("ploc").value.trim()||state.user.locality;
        if(LIVE){
          var b=this; b.disabled=true; b.textContent=t("saving");
          API.updateMe({name:n,locality:loc}).then(function(r){
            state.user.name=r.user.name; state.user.locality=r.user.locality||loc; save();
            toast(t("savedToast")); go("home");
          }).catch(function(e){ b.disabled=false; b.textContent=t("continue"); apiFail(e); });
          return;
        }
        state.user.name=n; state.user.locality=loc;
        state.user.phone=state.pendingPhone; state.onboarded=true; save();
        toast(t("loginToast")); go("home");
      });
    }
    if(route==="home"){
      var hs=document.getElementById("home-search");
      hs.addEventListener("keydown",function(e){ if(e.key==="Enter"){ state.browseQ=this.value; state.browseCat="all"; go("browse"); } });
    }
    if(route==="browse"){
      var bs=document.getElementById("browse-search");
      bs && bs.addEventListener("input",function(){ state.browseQ=this.value; var sc=app().scrollTop; render(); app().scrollTop=sc; document.getElementById("browse-search").focus(); });
      var cf=document.getElementById("cat-filter");
      cf && cf.addEventListener("change",function(){ go("browse",{cat:this.value}); });
      var rf=document.getElementById("reset-filter"); rf && rf.addEventListener("click",function(){ state.browseQ=""; go("browse",{cat:"all"}); });
    }
    if(route==="nearby"){
      var pa=document.getElementById("perm-allow"); pa&&pa.addEventListener("click",function(){ state.locAllowed=true; toast(t("locToast")); go("nearby"); });
      var pm=document.getElementById("perm-manual"); pm&&pm.addEventListener("click",function(){ state.locAllowed=true; toast(t("locManualToast")); go("nearby"); });
    }
    if(route==="post") wirePost();
    if(route==="preview"){
      document.getElementById("submit-ad").addEventListener("click",function(){ submitAd(); });
    }
    if(route==="notifications"){
      var mr=document.getElementById("mark-read"); mr.addEventListener("click",function(){
        state.notifs.forEach(function(n){n.unread=false;});
        if(LIVE){ API.markRead().then(function(){ toast(t("markedRead")); go("notifications"); }).catch(apiFail); return; }
        toast(t("markedRead")); go("notifications"); });
    }
    if(route==="chat") wireChat();
    if(route==="settings") wireSettings();
    if(route==="myprofile"){
      var lo2=document.getElementById("logout");
      if(lo2) lo2.addEventListener("click",function(){
        if(LIVE){ API.logout().catch(function(){}); API.setToken(null); LIVE=false; }
        state.onboarded=false; save(); _go("welcome"); });
    }
  }

  function resendDelegate(e){
    if(e.target&&e.target.id==="resend-now"){ state.otp={code:genOtp(),attempts:0}; toast(t("otpSent"));
      var dc=document.getElementById("demo-code"); if(dc) dc.textContent=state.otp.code; startResend(); }
  }

  function wirePost(){
    var d=state.draft;
    document.querySelectorAll("#type-seg button").forEach(function(b){ b.addEventListener("click",function(){ d.type=this.getAttribute("data-type"); save(); go("post"); }); });
    bindVal("d-cat","category"); bindVal("d-title","title"); bindVal("d-price","price");
    bindVal("d-unit","unit"); bindVal("d-desc","desc");
    var pr=document.getElementById("d-price"); pr && pr.addEventListener("input",function(){ this.value=this.value.replace(/\D/g,""); d.price=this.value; });
    document.getElementById("add-photo").addEventListener("click",function(){
      document.getElementById("photo-file").click();
    });
    document.getElementById("photo-file").addEventListener("change",function(e){
      var files=[].slice.call(e.target.files||[]).slice(0,6-d.photos.length);
      if(!files.length) return;
      var left=files.length;
      files.forEach(function(file){
        if(!/^image\//.test(file.type)){ left--; return; }
        shrink(file, function(dataUrl){
          if(dataUrl) d.photos.push(dataUrl);
          else toast(t("photoFailed"));
          if(--left<=0){ save(); toast(d.photos.length?t("photoAdded"):t("photoFailed"));
            var sc=app().scrollTop; go("post"); app().scrollTop=sc; }
        });
      });
    });
    document.querySelectorAll("[data-rmphoto]").forEach(function(b){ b.addEventListener("click",function(){ d.photos.splice(+this.getAttribute("data-rmphoto"),1); save(); var sc=app().scrollTop; go("post"); app().scrollTop=sc; }); });
    document.getElementById("add-video").addEventListener("click",function(){ d.video=true; toast(t("photoAdded")); });
    document.getElementById("d-gps").addEventListener("click",function(){ d.loc.mode="gps"; d.loc.locality=state.user.locality; save(); go("post"); toast(t("locToast")); });
    document.getElementById("d-manual").addEventListener("click",function(){ d.loc.mode="manual"; save(); go("post"); });
    bindLoc("d-district","district"); bindLoc("d-village","village");
    document.getElementById("post-next").addEventListener("click",function(){ postNext(); });
  }
  function bindVal(id,key){ var e=document.getElementById(id); if(e) e.addEventListener("input",function(){ state.draft[key]=this.value; }); e&&e.addEventListener("change",function(){ state.draft[key]=this.value; }); }
  function bindLoc(id,key){ var e=document.getElementById(id); if(e) e.addEventListener("input",function(){ state.draft.loc[key]=this.value; }); }

  function postNext(){
    var d=state.draft, bad=false;
    function mark(fid,cond){ var f=document.getElementById(fid); if(!f)return; if(cond){f.classList.add("invalid");bad=true;}else f.classList.remove("invalid"); }
    mark("f-title",!String(d.title).trim());
    mark("f-price",!(parseInt(d.price,10)>0));
    mark("f-desc",!String(d.desc).trim());
    if(d.type==="sale") mark("f-photo",d.photos.length<1);
    var locOk = d.loc.mode==="gps" || (d.loc.mode==="manual" && String(d.loc.district).trim() && String(d.loc.village).trim());
    mark("f-loc",!locOk);
    var fe=document.getElementById("post-form-error");
    if(bad){ fe.classList.add("show"); var fi=document.querySelector(".field.invalid"); fi&&fi.scrollIntoView({block:"center"}); return; }
    fe.classList.remove("show");
    d.loc.locality = d.loc.mode==="gps" ? state.user.locality : (d.loc.village+", "+d.loc.district);
    go("preview");
  }
  function submitAd(){
    var d=state.draft;
    var btn=document.getElementById("submit-ad"); if(btn){ btn.disabled=true; btn.textContent=t("saving"); }
    var id;
    if(d.editId){
      var ex=byId(d.editId); if(ex){ ex.title=d.title; ex.price=parseInt(d.price,10); ex.unit=d.unit; ex.desc=d.desc; ex.category=d.category; ex.type=d.type; ex.photos=d.photos.slice(); ex.loc=JSON.parse(JSON.stringify(d.loc)); ex.status="pending"; ex.rej=""; id=ex.id; }
    } else {
      id="u"+(state.nextId++);
      state.listings.unshift(L({id:id,owner:"me",type:d.type,category:d.category,title:d.title,price:parseInt(d.price,10),unit:d.unit,qty:d.qty,desc:d.desc,photos:d.photos.slice(),loc:JSON.parse(JSON.stringify(d.loc)),status:"pending",views:0,specs:{}}));
    }
    if(LIVE){
      var payload={type:d.type,category:d.category,title:d.title,price:parseInt(d.price,10),
        unit:d.unit,qty:d.qty||1,desc:d.desc,photos:d.photos.slice(),
        loc:{district:d.loc.district||"",village:d.loc.village||"",
             locality:d.loc.locality||"", lat:d.loc.mode==="gps"?9.93:null, lon:d.loc.mode==="gps"?78.12:null}};
      var done=function(res){
        var st=(res&&res.listing&&res.listing.status)||"pending";
        state.postedLive=(st==="active"); save();
        state.draft=null; save();
        toast(state.postedLive?t("liveToast"):t("postedToast")); go("success"); };
      var fail=function(e){ if(btn){btn.disabled=false;btn.textContent=t("submitApproval");} apiFail(e); };
      if(d.editId) API.editListing(d.editId,payload).then(done).catch(fail);
      else API.createListing(payload).then(done).catch(fail);
      return;
    }
    state.draft=null; save();
    toast(t("postedToast")); go("success");
  }

  function wireChat(){
    var body=document.getElementById("chat-body"); if(body) body.scrollTop=body.scrollHeight;
    if(LIVE){
      var cid0=(document.getElementById("chat-send")||{}).getAttribute
        ? document.getElementById("chat-send").getAttribute("data-cid") : null;
      if(cid0) API.messages(cid0).then(function(r){
        var c=convById(cid0); if(!c) return;
        c.msgs=(r.messages||[]).map(function(m){
          return {who:m.mine?"me":"them", en:m.body, ta:m.body, t:timeAgo(m.at,lang)};
        });
        if(r.other) c.other=mapUser(r.other);
        save(); if(route==="chat") renderChatBody(c);
      }).catch(function(){});
    }
    var inp=document.getElementById("chat-text");
    var sendBtn=document.getElementById("chat-send");
    function send(){
      var v=inp.value.trim(); if(!v) return; var cid=sendBtn.getAttribute("data-cid"); var c=convById(cid);
      c.msgs.push({who:"me",en:v,ta:v,t:t("justNow")}); inp.value=""; save();
      renderChatBody(c);
      if(LIVE){ API.sendMessage(cid,v).catch(apiFail); return; }
      setTimeout(function(){ c.msgs.push({who:"them",en:"Ok 👍",ta:"சரி 👍",t:t("justNow")}); save(); if(route==="chat") renderChatBody(c); },900);
    }
    sendBtn.addEventListener("click",send);
    inp.addEventListener("keydown",function(e){ if(e.key==="Enter") send(); });
  }
  function renderChatBody(c){
    var body=document.getElementById("chat-body"); if(!body) return;
    body.innerHTML=c.msgs.map(function(m){return '<div class="bubble '+m.who+'">'+esc(m[lang]||m.en)+'<span class="bt">'+m.t+'</span></div>';}).join("");
    body.scrollTop=body.scrollHeight;
  }

  function wireSettings(){
    document.querySelectorAll("[data-topic]").forEach(function(b){ b.addEventListener("click",function(){
      var k=this.getAttribute("data-topic"); var arr=state.user.alerts.cats; var i=arr.indexOf(k);
      if(i>=0) arr.splice(i,1); else arr.push(k); this.classList.toggle("on"); save();
    }); });
    document.querySelectorAll("[data-setradius]").forEach(function(b){ b.addEventListener("click",function(){ state.user.alerts.radius=+this.getAttribute("data-setradius"); go("settings"); }); });
    var adm=document.querySelector("[data-admin]"); adm&&adm.addEventListener("click",function(){ state.role=state.role==="admin"?"user":"admin"; save(); go("settings"); });
    var lo=document.getElementById("logout");
    if(lo) lo.addEventListener("click",function(){
      if(LIVE){ API.logout().catch(function(){}); API.setToken(null); LIVE=false; }
      state.onboarded=false; save(); _go("welcome"); });
    var rep=document.getElementById("replay"); rep&&rep.addEventListener("click",function(){ go("welcome"); });
    var del=document.getElementById("del-account"); del&&del.addEventListener("click",function(){ localStorage.removeItem(LS); load(); toast(t("resetToast")); go("welcome"); });
    var lh=document.getElementById("loc-help"); lh&&lh.addEventListener("click",function(){ toast(t("locDeniedHelp")); });
  }

  /* ---------- global delegation ---------- */
  document.addEventListener("click",function(e){
    var el=e.target.closest("[data-go],[data-setlang],[data-open],[data-chip],[data-seller],[data-chat],[data-msg],[data-call],[data-wa],[data-share],[data-notif],[data-edit],[data-sold],[data-del],[data-mytab],[data-toggle],[data-approve],[data-reject],[data-confirm-reject],[data-noop]");
    if(!el) return;
    if(el.hasAttribute("data-noop")){ return; }
    var g=el.getAttribute("data-go"); if(g){ go(g); return; }
    var sl=el.getAttribute("data-setlang"); if(sl){ lang=sl; save(); toast(t("langToast")); render(); return; }
    var op=el.getAttribute("data-open"); if(op){ go("listing",{id:op}); return; }
    var ch=el.getAttribute("data-chip"); if(ch){ go("browse",{cat:ch}); return; }
    var sv=el.getAttribute("data-seller"); if(sv){ go("seller",{id:sv}); return; }
    var ct=el.getAttribute("data-chat"); if(ct){ go("chat",{id:ct}); return; }
    var mg=el.getAttribute("data-msg"); if(mg){ openChatFor(mg); return; }
    var cl=el.getAttribute("data-call"); if(cl){ toast(t("callToast")); return; }
    var wa=el.getAttribute("data-wa"); if(wa){ var l=byId(wa); var s=sellerOf(l); toast(t("waToast")); setTimeout(function(){ window.open("https://wa.me/"+(s.number||"").replace(/\D/g,"")+"?text="+encodeURIComponent(l.title),"_blank"); },300); return; }
    var sh=el.getAttribute("data-share"); if(sh){ var l2=byId(sh); toast(t("waToast")); setTimeout(function(){ window.open("https://wa.me/?text="+encodeURIComponent(l2.title+" — "+INR(l2.price)),"_blank"); },300); return; }
    var nf=el.getAttribute("data-notif"); if(nf){ openNotif(nf); return; }
    var ed=el.getAttribute("data-edit"); if(ed){ editListing(ed); return; }
    var sd=el.getAttribute("data-sold"); if(sd){
      if(LIVE){ API.editListing(sd,{status:"sold"}).then(function(){ toast(t("soldToast")); go("mylistings",{tab:"active"}); }).catch(apiFail); return; }
      var ls=byId(sd); ls.status="sold"; save(); toast(t("soldToast")); go("mylistings",{tab:"active"}); return; }
    var dl=el.getAttribute("data-del"); if(dl){
      if(LIVE){ API.deleteListing(dl).then(function(){ toast(t("deletedToast")); go("mylistings",{tab:"active"}); }).catch(apiFail); return; }
      var idx=state.listings.indexOf(byId(dl)); if(idx>=0) state.listings.splice(idx,1); save(); toast(t("deletedToast")); go("mylistings",{tab:"active"}); return; }
    var mt=el.getAttribute("data-mytab"); if(mt){ go("mylistings",{tab:mt}); return; }
    var tg=el.getAttribute("data-toggle"); if(tg){ state.user[tg]=!state.user[tg]; el.classList.toggle("on");
      el.setAttribute("aria-checked",state.user[tg]); save();
      if(LIVE){ var pch={}; pch[tg==="call"?"allow_call":"allow_whatsapp"]=state.user[tg];
        API.updateMe(pch).then(function(){ toast(t("savedToast")); }).catch(apiFail); }
      else toast(t("savedToast")); return; }
    var ap=el.getAttribute("data-approve"); if(ap){ approve(ap); return; }
    var rj=el.getAttribute("data-reject"); if(rj){ var rr=document.getElementById("rr-"+rj); rr&&rr.classList.toggle("show"); return; }
    var cr=el.getAttribute("data-confirm-reject"); if(cr){ confirmReject(cr); return; }
  });

  function openChatFor(listingId){
    var l=byId(listingId); if(!l) return;
    if(l.owner==="me"){ toast(t("selfChat")); return; }
    if(LIVE){
      API.openConversation(listingId).then(function(r){
        var cid=String(r.conversation_id);
        if(!convById(cid)) state.convos.unshift({id:cid,listing:listingId,
          withKey:l.owner, other:sellerOf(l), unread:0, msgs:[]});
        save(); go("chat",{id:cid});
      }).catch(apiFail);
      return;
    }
    var found=null; for(var i=0;i<state.convos.length;i++){ if(state.convos[i].listing===listingId){ found=state.convos[i]; break; } }
    if(!found){ found={id:"c"+(state.nextId++),listing:listingId,withKey:l.owner,unread:0,msgs:[]}; state.convos.unshift(found); save(); }
    go("chat",{id:found.id});
  }
  function openNotif(id){
    var n=null; for(var i=0;i<state.notifs.length;i++) if(state.notifs[i].id===id){ n=state.notifs[i]; break; }
    if(!n) return; n.unread=false; save();
    if(n.type==="message"&&n.conv) go("chat",{id:n.conv});
    else if((n.type==="approved"||n.type==="rejected")&&n.listing) go("listing",{id:n.listing});
    else go("nearby");
  }
  function editListing(id){
    var l=byId(id); if(!l) return;
    state.draft={type:l.type,category:l.category,title:l.title,price:String(l.price),unit:l.unit,qty:l.qty,desc:l.desc,photos:l.photos.slice(),video:l.video,loc:JSON.parse(JSON.stringify(l.loc)),editId:id};
    if(!state.draft.loc.mode) state.draft.loc.mode="manual";
    save(); go("post");
  }
  function approve(id){
    if(LIVE){ API.approve(id).then(function(){ toast(t("approvedToast")); go("admin"); }).catch(apiFail); return; }
    var l=byId(id); if(!l||l.status!=="pending") return;
    l.status="active"; l.views=l.views||0; save();
    if(l.owner==="me") state.notifs.unshift({id:"n"+(state.nextId++),type:"approved",listing:id,unread:true,time:{en:"just now",ta:"இப்போது"},extra:{en:l.title+" is now live.",ta:l.title+" இப்போது நேரலையில்."}});
    toast(t("approvedToast")); go("admin");
  }
  function confirmReject(id){
    var l=byId(id); if(!l) return;
    var rr=document.getElementById("rr-"+id); var ta=rr?rr.querySelector("textarea"):null;
    var reason=ta?ta.value.trim():"";
    if(!reason){ toast(t("needReason")); ta&&ta.focus(); return; }
    if(LIVE){ API.reject(id,reason).then(function(){ toast(t("rejectedToast")); go("admin"); }).catch(apiFail); return; }
    l.status="rejected"; l.rej=reason; save();
    if(l.owner==="me") state.notifs.unshift({id:"n"+(state.nextId++),type:"rejected",listing:id,unread:true,time:{en:"just now",ta:"இப்போது"},extra:{en:reason,ta:reason}});
    toast(t("rejectedToast")); go("admin");
  }

  /* ============================================================
     NOTIFICATIONS
     Asked for right after joining, but behind our OWN card first:
     firing the browser prompt cold gets denied, and a denial cannot be
     undone from inside the page - the user has to dig into site settings.
     ============================================================ */
  function notifSupported(){ return typeof Notification !== "undefined"; }

  /* ---- Web Push: delivery with the app CLOSED ----
     The poller above only runs in an open tab. Registering a push
     subscription hands delivery to the browser's own push service, which can
     wake the service worker with the app shut. */
  function b64ToU8(base64){
    var pad="=".repeat((4 - base64.length % 4) % 4);
    var raw=atob((base64+pad).replace(/-/g,"+").replace(/_/g,"/"));
    var out=new Uint8Array(raw.length);
    for(var i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i);
    return out;
  }
  function subscribePush(){
    if(!LIVE || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if(notifState()!=="granted") return;
    return navigator.serviceWorker.ready.then(function(reg){
      return API.pushKey().then(function(k){
        if(!k || !k.enabled || !k.key) return;
        return reg.pushManager.getSubscription().then(function(existing){
          if(existing) return existing;
          return reg.pushManager.subscribe({
            userVisibleOnly:true,
            applicationServerKey:b64ToU8(k.key)
          });
        });
      });
    }).then(function(sub){
      if(sub) return API.pushSubscribe(sub.toJSON());
    }).catch(function(){ /* push unavailable on this device - in-app still works */ });
  }
  function notifState(){ return notifSupported() ? Notification.permission : "unsupported"; }

  function maybeAskNotifications(){
    if(!notifSupported()) return;
    if(Notification.permission !== "default") return;      // already decided
    try{ if(localStorage.getItem("ns_notif_asked")==="1") return; }catch(e){}
    showNotifCard();
  }
  function showNotifCard(){
    var bar=document.getElementById("notif-ask"); if(!bar) return;
    document.getElementById("na-title").textContent=t("notifAskTitle");
    document.getElementById("na-sub").textContent=t("notifAskSub");
    document.getElementById("notif-allow").textContent=t("notifAllow");
    document.getElementById("notif-later").textContent=t("notNow");
    bar.hidden=false;
  }
  function hideNotifCard(){ var b=document.getElementById("notif-ask"); if(b) b.hidden=true; }

  document.addEventListener("click",function(e){
    if(!e.target) return;
    if(e.target.id==="notif-allow" || e.target.id==="notif-allow-2"){
      try{ localStorage.setItem("ns_notif_asked","1"); }catch(err){}
      hideNotifCard();
      if(!notifSupported()) return;
      // Must be called from this click - browsers reject a cold request.
      Notification.requestPermission().then(function(p){
        toast(p==="granted" ? t("notifOn") : t("notifOff"));
        if(p==="granted"){ startNotifPolling(); subscribePush(); }
      }).catch(function(){});
    }
    if(e.target.id==="notif-test"){
      if(notifState()!=="granted"){ toast(t("notifOff")); return; }
      // Ask the SERVER to push us - that is what proves closed-app delivery.
      if(LIVE){
        subscribePush();
        API.pushTest().then(function(r){
          toast(r && r.sent_to_devices ? t("notifTestSent") : t("notifTestNoDevice"));
        }).catch(function(){
          try{ new Notification(t("notifTestTitle"),{body:t("notifTestBody"),
               icon:"icons/icon-192.png",tag:"ns-test"}); }catch(err){}
        });
      } else {
        try{ new Notification(t("notifTestTitle"),{body:t("notifTestBody"),
             icon:"icons/icon-192.png",tag:"ns-test"}); toast(t("notifTestSent")); }catch(err){}
      }
      return;
    }
    if(e.target.id==="notif-later"){
      try{ localStorage.setItem("ns_notif_asked","1"); }catch(err){}
      hideNotifCard();
    }
  });

  // While the app is open, poll the server and raise a real notification for
  // anything new. (True background push needs a push service + VAPID keys and
  // is a separate piece of work - this does not pretend to be that.)
  var notifTimer=null, lastNotifId=0, notifPrimed=false;
  function pollNotifications(){
    if(!LIVE || !API.token) return;
    if(notifState()!=="granted") return;
    API.notifications().then(function(r){
      var list=r.notifications||[];
      var maxId=list.length?Math.max.apply(null,list.map(function(n){return n.id;})):0;
      // THE BUG THIS FIXES: the old code used `if(!lastNotifId)` to detect the
      // first pass. A new account has NO notifications, so lastNotifId stayed 0
      // (falsy) and every single poll re-took the first-pass branch - the first
      // notification could never fire. Prime with an explicit flag instead.
      if(!notifPrimed){ notifPrimed=true; lastNotifId=maxId; return; }
      list.filter(function(n){ return n.id>lastNotifId && n.unread; })
          .forEach(fireNotification);
      if(maxId>lastNotifId) lastNotifId=maxId;
    }).catch(function(){});
  }
  function startNotifPolling(){
    if(notifTimer || !LIVE) return;
    if(notifState()!=="granted") return;
    pollNotifications();                                  // prime straight away
    notifTimer=setInterval(function(){
      if(document.hidden) return;                         // don't buzz a backgrounded tab
      pollNotifications();
    }, 12000);
    // Coming back to the app should check immediately, not wait for the timer.
    document.addEventListener("visibilitychange",function(){
      if(!document.hidden) pollNotifications();
    });
  }
  function fireNotification(n){
    if(notifState()!=="granted") return;
    var p=n.payload||{};
    var title = n.type==="message" ? t("nMessage")
              : n.type==="approved" ? t("nApproved")
              : n.type==="rejected" ? t("nRejected") : t("nNearby");
    var body = p.preview || p.title || p.reason || "";
    try{
      var no=new Notification(title,{body:body,icon:"icons/icon-192.png",
        badge:"icons/icon-192.png",tag:"ns-"+n.id});
      no.onclick=function(){ window.focus();
        if(n.type==="message"&&n.conv_id) go("chat",{id:String(n.conv_id)});
        else go("notifications");
        no.close(); };
    }catch(e){}
  }

  /* ---------- PWA install ---------- */
  var IT={
    en:{title:"Install Namma Santhai",sub:"Add it to your home screen",btn:"Install",
        ios:"To install: tap Share ⎙ then “Add to Home Screen”.",done:"App installed!"},
    ta:{title:"நம்ம சந்தை நிறுவு",sub:"முகப்புத் திரையில் சேர்க்கவும்",btn:"நிறுவு",
        ios:"நிறுவ: Share ⎙ தொட்டு “Add to Home Screen” தேர்வு செய்யவும்.",done:"ஆப் நிறுவப்பட்டது!"}};
  function it(k){ return (IT[lang]&&IT[lang][k])||IT.en[k]; }
  var deferredPrompt=null;
  function isStandalone(){
    try{
      return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
          || (window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches)
          || (window.matchMedia && window.matchMedia("(display-mode: minimal-ui)").matches)
          || window.navigator.standalone===true
          || document.referrer.indexOf("android-app://")===0;
    }catch(e){ return false; }
  }
  function isIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1); } // iPadOS 13+
  function hideInstallBar(){ var b=document.getElementById("install-bar"); if(b) b.hidden=true; }
  // Once installed we remember it, so the prompt never returns on this device.
  function markInstalled(){ try{ localStorage.setItem("ns_installed","1"); }catch(e){} hideInstallBar(); }
  function suppressed(){
    try{
      if(localStorage.getItem("ns_installed")==="1") return true;
      var until=parseInt(localStorage.getItem("ns_install_snooze")||"0",10);
      return until>0 && Date.now()<until;
    }catch(e){ return false; }
  }
  function showInstallBar(mode){
    if(isStandalone()){ markInstalled(); return; }   // running as an app → never ask
    if(suppressed()) return;
    var bar=document.getElementById("install-bar"); if(!bar) return;
    document.getElementById("ib-title").textContent=it("title");
    document.getElementById("ib-sub").textContent= mode==="ios"?it("ios"):it("sub");
    var btn=document.getElementById("install-btn"); btn.textContent=it("btn");
    btn.style.display = mode==="ios" ? "none" : "";
    bar.hidden=false;
  }
  // If it was launched standalone at any point, record it immediately.
  if(isStandalone()) markInstalled();
  // Chrome/Android also reports related installed apps where supported.
  if(navigator.getInstalledRelatedApps){
    navigator.getInstalledRelatedApps().then(function(apps){ if(apps&&apps.length) markInstalled(); }).catch(function(){});
  }
  window.addEventListener("beforeinstallprompt",function(e){ e.preventDefault(); deferredPrompt=e; showInstallBar("prompt"); });
  window.addEventListener("appinstalled",function(){ markInstalled(); toast(it("done")); });
  // display-mode can flip without a reload (e.g. opened from the new icon)
  try{ window.matchMedia("(display-mode: standalone)").addEventListener("change",function(ev){ if(ev.matches) markInstalled(); }); }catch(e){}
  document.addEventListener("click",function(e){
    if(e.target&&e.target.id==="install-btn"&&deferredPrompt){ deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(c){ deferredPrompt=null; hideInstallBar();
        if(c&&c.outcome==="accepted") markInstalled(); }); }
    if(e.target&&e.target.id==="install-x"){ hideInstallBar();
      // snooze 30 days rather than nagging on every visit
      try{ localStorage.setItem("ns_install_snooze", String(Date.now()+30*24*60*60*1000)); }catch(err){} }
  });

  /* ============================================================
     LIVE MODE — real server accounts.
     Server objects are mapped into the SAME shapes the screens
     already render, so the UI code below needs no changes.
     ============================================================ */
  var API = window.NS_API;
  var LIVE = false;

  function mapUser(u){
    if(!u) return {id:0,name:"User",initial:"U",verified:false,online:false,seen:0,
                   call:false,whatsapp:false,number:"",since:"",locality:""};
    var ago = Math.max(0, Math.round((Date.now()/1000 - (u.last_seen||0))/60));
    return {id:u.id, name:u.name||("User "+u.id), initial:((u.name||"U").trim()[0]||"U").toUpperCase(),
            verified:!!u.verified, online:ago<5, seen:ago,
            call:!!u.allow_call, whatsapp:!!u.allow_whatsapp, number:u.phone||"",
            since:u.member_since?new Date(u.member_since*1000).toLocaleDateString(
              lang==="ta"?"ta-IN":"en-IN",{month:"short",year:"numeric"}):"",
            locality:u.locality||""};
  }
  function mapListing(s){
    var owner = mapUser(s.owner);
    var mine  = state.user.id && s.owner && s.owner.id===state.user.id;
    return L({
      id:String(s.id), owner: mine?"me":("u"+(s.owner&&s.owner.id)), ownerObj: mine?meSeller():owner,
      type:s.type, category:s.category, title:s.title, price:s.price, unit:s.unit, qty:s.qty,
      desc:s.desc||"", specs:s.specs||{}, status:s.status, rej:s.reject_reason||"", views:s.views||0,
      photos:(s.photos||[]).map(function(p){return API.mediaUrl(p);}),
      loc:{mode:(s.loc&&s.loc.lat)?"gps":"manual", district:(s.loc&&s.loc.district)||"",
           village:(s.loc&&s.loc.village)||"",
           locality:(s.loc&&(s.loc.locality|| [s.loc.village,s.loc.district].filter(Boolean).join(", ")))||"",
           km:0}
    });
  }
  function shrink(file, cb){
    var MAX=1280, Q=0.82;
    var fr=new FileReader();
    fr.onerror=function(){ cb(null); };
    fr.onload=function(){
      var img=new Image();
      img.onerror=function(){ cb(null); };
      img.onload=function(){
        var w=img.width, h=img.height;
        var sc=Math.min(1, MAX/Math.max(w,h));      // never upscale
        var cv=document.createElement("canvas");
        cv.width=Math.round(w*sc); cv.height=Math.round(h*sc);
        try{
          cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);
          cb(cv.toDataURL("image/jpeg",Q));
        }catch(e){ cb(fr.result); }
      };
      img.src=fr.result;
    };
    fr.readAsDataURL(file);
  }

  function busy(on){ var el=document.getElementById("toast");
    if(on){ el.textContent="…"; el.classList.add("show"); } else el.classList.remove("show"); }

  function apiFail(e){
    if(e && (e.status===401||e.code==="unauthorized")){
      API.setToken(null); state.onboarded=false; save(); toast(t("logout")); go("welcome"); return;
    }
    toast((e && e.message) ? e.message : "Network error");
  }

  // Pull the data a given screen needs, then re-render.
  function syncFor(route){
    if(!LIVE) return Promise.resolve();
    var jobs=[];
    if(["home","browse","nearby","listing"].indexOf(route)>=0){
      jobs.push(Promise.all([
        API.listings({limit:60}),
        API.token ? API.myListings().catch(function(){return {listings:[]};}) : Promise.resolve({listings:[]})
      ]).then(function(res){
        var feed = (res[0].listings||[]).map(mapListing);
        var ids  = {}; feed.forEach(function(l){ ids[l.id]=1; });
        // your own pending/rejected ads, which the public feed correctly omits
        var mine = (res[1].listings||[]).map(mapListing).filter(function(l){ return !ids[l.id]; });
        state.listings = feed.concat(mine);
      }));
    }
    if(["mylistings","post","preview"].indexOf(route)>=0){
      jobs.push(API.myListings().then(function(r){
        var others = state.listings.filter(function(l){return l.owner!=="me";});
        state.listings = others.concat((r.listings||[]).map(mapListing));
      }));
    }
    if(route==="admin"){
      jobs.push(API.pending().then(function(r){
        var others = state.listings.filter(function(l){return l.status!=="pending";});
        state.listings = others.concat((r.listings||[]).map(mapListing));
      }));
    }
    if(route==="notifications"||route==="home"){
      jobs.push(API.notifications().then(function(r){
        state.notifs = (r.notifications||[]).map(function(n){
          var p=n.payload||{};
          var txt = n.type==="rejected" ? (p.reason||"") :
                    n.type==="message"  ? (p.preview||"") : (p.title||"");
          return {id:String(n.id), type:n.type, listing:n.listing_id?String(n.listing_id):null,
                  conv:n.conv_id?String(n.conv_id):null, unread:n.unread,
                  time:{en:timeAgo(n.at,"en"), ta:timeAgo(n.at,"ta")},
                  extra:{en:txt, ta:txt}};
        });
      }));
    }
    if(route==="messages"){
      jobs.push(API.conversations().then(function(r){
        state.convos = (r.conversations||[]).map(function(c){
          var o=mapUser(c.other);
          return {id:String(c.id), listing:String(c.listing_id), withKey:"u"+o.id, other:o,
                  unread:c.unread||0, sub:c.listing?(c.listing.title+" · "+INR(c.listing.price)):"",
                  msgs:c.last?[{who:c.last.mine?"me":"them",en:c.last.body,ta:c.last.body,
                                t:timeAgo(c.last.at,lang)}]:[]};
        });
      }));
    }
    return Promise.all(jobs).catch(apiFail);
  }
  function timeAgo(ts,lg){
    var s=Math.max(0, Math.round(Date.now()/1000-(ts||0)));
    var ta=lg==="ta";
    if(s<60) return ta?"இப்போது":"just now";
    if(s<3600) return Math.round(s/60)+(ta?" நிமிடம் முன்":" min ago");
    if(s<86400) return Math.round(s/3600)+(ta?" மணி முன்":" hr ago");
    return Math.round(s/86400)+(ta?" நாள் முன்":" d ago");
  }

  // Wrap the router so live screens fetch before painting.
  var _go = go;
  go = function(r,p){
    if(!LIVE) return _go(r,p);
    _go(r,p);                                   // paint immediately (cached data)
    syncFor(r).then(function(){ if(route===r) _go(r,p); });
  };

  function startLive(user){
    LIVE = true;
    state.user.id = user.id;
    state.user.name = user.name||"";
    state.user.phone = user.phone||"";
    state.user.locality = user.locality||state.user.locality;
    state.user.call = !!user.allow_call;
    state.user.whatsapp = !!user.allow_whatsapp;
    state.role = user.role||"user";
    state.onboarded = true;
    state.listings = []; state.convos = []; state.notifs = [];
    save();
  }

  /* ---------- boot ---------- */
  load();
  _go(state.onboarded ? "home" : "welcome");

  if(API && API.enabled){
    API.health().then(function(h){
      if(!h || !h.ok) return;
      if(API.token){
        return API.me().then(function(r){ startLive(r.user); go("home");
                 setTimeout(function(){ maybeAskNotifications(); startNotifPolling(); subscribePush(); },900); })
                      .catch(function(){ API.setToken(null); state.onboarded=false; save(); _go("welcome"); });
      }
      state.onboarded=false; save(); _go("welcome");
    }).catch(function(){ /* backend down -> stay in on-device demo */ });
  }

  if("serviceWorker" in navigator){
    window.addEventListener("load",function(){ navigator.serviceWorker.register("sw.js").catch(function(){}); });
  }
  // iOS Safari has no beforeinstallprompt — show manual instructions after a moment
  if(isIOS() && !isStandalone()){ setTimeout(function(){ showInstallBar("ios"); },1800); }
})();
