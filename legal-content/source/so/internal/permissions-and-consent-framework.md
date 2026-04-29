Qaab-dhismeedka Oggolaanshaha iyo فرض
Oggolaanshaha moobilka Drivest, فرض ikhtiyaari ah, iyo qaabka diiwaangelinta (logging)
Nooca
Nooca 1.1
Ugu dambayn la cusboonaysiiyay
5 Abriil 2026
Loo diyaariyay
Drivest Limited

Ujeeddada dukumentiga
Dukumentigan gudaha ah wuxuu qeexayaa sida oggolaanshaha iyo فرض hadda looga codsanayo app-ka si safarka moobilku uu ugu ahaado mid dhib yar, si sharci ah loo difaaci karo, isla markaana waafaqsan mareegaha hadda, hab-dhaqanka app-ka, iyo qaabka diiwaangelinta backend-ka.

1. Ujeeddada dukumentigan
Dukumentigan wuxuu dejinayaa qaab-dhismeedka oggolaanshaha iyo فرض ee hadda ee Drivest. Waxaa loogu talagalay in khibradda moobilka laga dhigo mid la isticmaali karo iyadoo weli la waafajinayo booska sharciga, arrimaha khaaska ah, iyo booska dukaanka app-ka (app store).
Mabda'a asaasiga ahi wuxuu ahaanayaa sidii hore. Drivest waa inay weydiisataa oo keliya oggolaanshaha lagama maarmaanka ah, waa inay weydiisataa iyadoo ku jirta macnaha (context), waa inaysan horay u awood gelin doorashooyinka ikhtiyaariga ah, waana inay awood u lahaataa inay caddeyso waxa isticmaalahu doortay iyo goorta uu doortay.

2. Qaabka oggolaanshaha onboarding-ka ee hadda
Drivest hadda waxay isticmaashaa qaab onboarding ah oo laba marxaladood ah.

Marxaladda 1-aad waxay qabataa aqbalaadda sharciga ee khasabka ah. Waxay daboolaysaa:
- Aqbalaadda Shuruudaha iyo Xaaladaha
- Aqbalaadda Siyaasadda Arrimaha Khaaska ah
- xaqiijinta da'da
- qiraalka ogeysiiska badbaadada

Marxaladda 2-aad waxay qabataa oggolaanshaha shaqada iyo فرض ikhtiyaari ah. Waxay soo bandhigaysaa:
- gelitaanka goobta (location access)
- doorashada analytics
- doorashada ogeysiisyada

Goobtu waxay muhiim u tahay dhinaca shaqada ee muuqaalada la xiriira marinka iyo baarkinka, laakiin weli waxay ahaanaysaa oggolaansho nidaamka qalliinka ah (operating system). Analytics waa ikhtiyaari. Ogeysiisyadu waa ikhtiyaari.

3. Marxaladda aqbalaadda sharciga ee khasabka ah
Marxaladda koowaad ee onboarding-ka waa inay si cad u sheegtaa in Drivest ay tahay madal taageerta darawalnimada oo bixisa hagid oo keliya.
Waa inay si cad u sheegtaa in Drivest aysan beddelaynin xukunka isticmaalaha, macalinka darawalnimada, ama sharciga.
Marxaladdu waa inay bixisaa gelitaanka Shuruudaha iyo Xaaladaha iyo Siyaasadda Arrimaha Khaaska ah ka hor inta uusan isticmaalahu sii wadin.
Isticmaalahu waa inuu si firfircoon u calaamadeeyaa sanduuqa ka hor inta uusan sii wadin.
App-ku waa inuusan sii wadin ilaa sanduuqaas laga dooranayo.
Isla marxaladdan ayaa lagu qabanayaa xaqiijinta da'da iyo qiraalka badbaadada oo qayb ka ah dhacdada aqbalaadda.
Backend-ku waa inuu kaydiyaa nooca shuruudaha la aqbalay, nooca arrimaha khaaska ah, nooca badbaadada, wakhtiga aqbalaadda, shaashadda laga soo galay, nooca app-ka, madasha, iyo aqoonsiga rakibidda halkii laga heli karo.

4. Oggolaanshaha goobta (Location)
Goobta waa in lagu codsadaa ficil ku dhex jira macnaha (in-context) ka dibna loo maraa wada-hadalka oggolaanshaha nidaamka qalliinka.
Ereyada sharraxaadda ah waa inay ahaadaan kuwo waafaqsan booska arrimaha khaaska ah ee hadda:
- goobta waxaa loo isticmaalaa marinnada iyo hagidda marka ay firfircoon tahay
- muuqaalada marinka iyo baarkinka waxay u baahan yihiin goobta marka isticmaalahu isku dayo inuu isticmaalo
- Drivest waa inaysan tilmaamin in taariikhda goobta ee asalka ah (background) ee joogtada ah lagu kaydiyo server-yada

Haddii isticmaalahu diido oggolaanshaha goobta, app-ka waxaa laga yaabaa inuu xaddido muuqaalada la xiriira marinka iyo baarkinka, laakiin waa inuusan xannibin muuqaalada barashada ee aan xiriirka la lahayn.
App-ku waa inuu kaydiyaa doorashada goobta ee waxtarka leh ee isticmaalaha mid ka mid ah:
- allow (oggolow)
- deny (diid)
- skip (ka bood)

5. فرض (Consent) analytics
Analytics waa inay ahaataa mid ikhtiyaari ah halka فرض uu yahay saldhigga sharciga ee loogu talagalay.
Hab-dhaqanka analytics waa inuu ahaadaa mid damsan ilaa isticmaalahu uu sameeyo doorasho dhab ah.
Interface-ka isticmaalaha waa inuu analytics ku sifeeyaa mid gacan ka geysata hagaajinta waxqabadka iyo kalsoonida.
Interface-ku waa inuusan soo jeedin in analytics loo baahan yahay si loo isticmaalo adeegga asaasiga ah.
Backend-ku waa inuu kaydiyaa:
- analyticsChoice
- wakhtiga (timestamp)
- dusha sare ee laga soo galay (source surface)
- nooca app-ka
- madasha
- aqoonsiga rakibidda halkii laga heli karo

6. فرض (Consent) ogeysiisyada
Ogeysiisyadu waa inay ahaadaan kuwo ikhtiyaari ah.
Dhiirigelintu waa inay qeexdaa ujeeddadooda shaqo, oo ay ku jiraan cusboonaysiinta, boos qabsashada, xusuusinta, iyo dhaqdhaqaaqa xisaabta ee muhiimka ah halkii ay khuseyso.
Ogeysiisyadu waa inaan hore looga soo awood gelin asalka (default).
App-ku waa inuu si gooni ah u kaydiyaa doorashada doorbididda app-ka dhexdiisa marka loo eego natiijada oggolaanshaha nidaamka qalliinka.
Backend-ku waa inuu kaydiyaa:
- notificationsChoice
- wakhtiga (timestamp)
- dusha sare ee laga soo galay (source surface)
- nooca app-ka
- madasha
- aqoonsiga rakibidda halkii laga heli karo

7. Shuruudaha diiwaangelinta (Logging)
Nidaamku waa inuu diiwaangeliyaa dhacdada aqbalaadda sharciga si gooni ah doorashooyinka oggolaanshaha iyo فرض.
Ugu yaraan, backend-ku waa inuu kaydiyaa:
- nooca shuruudaha
- nooca arrimaha khaaska ah
- nooca badbaadada
- wakhtiga aqbalaadda
- xaaladda xaqiijinta da'da
- doorashada analytics
- wakhtiga analytics
- doorashada ogeysiisyada
- wakhtiga ogeysiisyada
- doorashada goobta
- wakhtiga goobta
- shaashadda ama dusha sare ee laga soo galay
- nooca app-ka
- madasha
- aqoonsiga rakibidda halkii laga heli karo

8. Shuruudda hirgelinta hadda
Qaab-dhismeedka oggolaanshaha waa inuu u dhigmaa hab-dhaqanka dhabta ah ee app-ka.
Haddii qulqulka sharcigu uu analytics ku sifeeyo mid ikhtiyaari ah, analytics waa inay dhab ahaan ahaataa mid ikhtiyaari ah xagga hirgelinta.
Haddii app-ku kaydiyo doorashada goobta oo qayb ka ah onboarding-ka, qaabka xogtaas waa inuu ka muuqdaa dukumentiga u hoggaansanaanta gudaha.
Haddii app-ka dambe lagu daro oggolaansho cusub, hab-dhaqan raadraac oo cusub, ama farsamaynta goobta asalka ah ee joogtada ah, qaab-dhismeedka oggolaanshaha, siyaasadda arrimaha khaaska ah, nuqulka app-ka dhexdiisa, iyo bayaannada dukaanka dhammaantood waa in la wada cusboonaysiiyaa ka hor intaan la sii deyn.

9. Alaabta oggolaanshaha ee hadda
Oggolaanshaha ama doorashada
Booska u dambeeya

Qiraalka sharciga ee khasabka ah ee laysku daray
Aqbalaadda Shuruudaha, Aqbalaadda Arrimaha Khaaska ah, xaqiijinta da'da, iyo qiraalka badbaadada. Waxaa loo baahan yahay ka hor inta uusan isticmaalahu gelin alaabta.

Goobta (Location)
Waxaa lagu codsaday macnaha si loo taageero marinnada, hagidda, iyo muuqaalada ku tiirsan goobta. Waxaa xukuma nidaamka qalliinka, laakiin app-ka sidoo kale wuxuu kaydiyaa xaalad doorasho oo la duubay.

Analytics
فرض (Consent) ikhtiyaari ah. Waa inay ahaataa mid damsan ilaa isticmaalahu ka sameeyo doorasho dhab ah.

Ogeysiisyada (Notifications)
فرض (Consent) ikhtiyaari ah. Waa inaan hore loo awood gelin. Dejinta aaladda ayaa ahaanaysa awoodda oggolaanshaha ee ugu dambaysa, halka app-ku uu kaydinayo doorashada doorbididda app-ka dhexdiisa ee isticmaalaha.
