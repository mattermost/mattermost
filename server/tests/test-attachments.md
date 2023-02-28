# Testing Files and Attachments
This test contains instructions for the core team to manually test common attachment types. All files for testing are stored in the [mm_file_testing](https://drive.google.com/drive/folders/0B9-SWBTtyOCBRlEyaW1IdkZ4X1k) Drive folder. Follow these instructions:

1. Download the entire [mm_file_testing](https://drive.google.com/drive/folders/0B9-SWBTtyOCBRlEyaW1IdkZ4X1k) folder. 
2. Drag and drop each file type into Mattermost to upload it (upload some as multiple attachments on the same post)
3. Post the file attachment

**Notes:**  
- All file types should upload and post.
- Read the expected for details on the behavior of the thumbnail and preview window.  
- The expected behavior of video and audio formats depends on the operating system, browser and plugins. View the permalinks to the Public Test Channel on Pre-Release Core to see the expected cases.   
- If the browser can play the media file, media player controls should appear. If the browser cannot play the file, it should  appear as a regular attachment without the media controls.


### Images  
**JPG**  
`Images/JPG.jpg`  
Expected: Scaled thumbnail & preview window  
[Permalink](https://pre-release.mattermost.com/core/pl/bgx3wcd9ppdo7fz9zqokofg7sc)

**PNG**  
`Images/PNG.png`  
Expected: Scaled thumbnail & preview window  
[Permalink](https://pre-release.mattermost.com/core/pl/zra4yhm69j8ij81iy5hw7983qe)

**BMP**  
`Images/BMP.bmp`  
Expected: Scaled thumbnail & preview window  
[Permalink](https://pre-release.mattermost.com/core/pl/1hx7x7t1npn4jqyr5rb1qhbj3h)

**GIF**  
`Images/GIF.gif`  
Expected: Scaled thumbnail & preview window. GIF should auto-play in the preview window.  
[Permalink](https://pre-release.mattermost.com/core/pl/j49fowdkstr57g3ed9bgpfoo5w)

**TIFF**  
`Images/TIFF.tiff`  
Expected: Generic attachment thumbnail & preview window  
[Permalink](https://pre-release.mattermost.com/core/pl/6yad4jydaidr3pc3tihp8n8bge)

**PSD**  
`Images/PSD.psd`  
Expected: Generic attachment thumbnail & preview window  
[Permalink](https://pre-release.mattermost.com/core/pl/4kitwk7pi78c9ck4i98f9xnzoe)


### Documents

**PDF Files**  
`Documents/PDF.pdf`  
Expected: Generic PDF thumbnail. File previewer shows first 5 pages of the PDF.   
[Permalink](https://pre-release.mattermost.com/core/pl/o1dg6menetdszrhyxmtoqjfi8h)


**Excel**  
`Documents/Excel.xlsx`  
Expected: Generic Excel thumbnail & preview window.  
[Permalink](https://pre-release.mattermost.com/core/pl/71wwezy3f7drze6ipundscb17y)


**PPT**  
`Documents/PPT.pptx`  
Expected: Generic Powerpoint thumbnail & preview window.   
[Permalink](https://pre-release.mattermost.com/core/pl/mx37h4znwb8f5ffuoajusqhiew)

**Word**  
`Documents/Word.docx`  
Expected: Generic Word thumbnail & preview window.  
[Permalink](https://pre-release.mattermost.com/core/pl/d7s76wp6kjdwfp4hgrwpijsnyy)

**Text**  
`Documents/Text.txt`  
Expected: Generic code thumbnail & file previewer.
[Permalink](https://pre-release.mattermost.com/core/pl/cpw539wcxtdmzeh5ju71y73o4e)

### Videos

**MP4**  
`Videos/MP4.mp4`  
Expected: Generic video thumbnail, view Permalink for preview window behavior. Expected depends on the operating system, browser and plugins.    
[Permalink](https://pre-release.mattermost.com/core/pl/5dx5qx9t9brqfnhohccxjynx7c)

**AVI**  
`Videos/AVI.avi`  
Expected: Generic video thumbnail, view Permalink for preview window behavior. Expected depends on the operating system, browser and plugins.  
[Permalink](https://pre-release.mattermost.com/core/pl/qwn9eiy7j3rkjyruxhcugpogdw)

**MKV**  
`Videos/MKV.mkv`  
Expected: Generic video thumbnail, view Permalink for preview window behavior. Expected depends on the operating system, browser and plugins.  
[Permalink](https://pre-release.mattermost.com/core/pl/tszyjkr1cidhxjgiusa4mde3ja)

**MOV**  
`Videos/MOV.mov`  
Expected: Generic video thumbnail, view Permalink for preview window behavior. Expected depends on the operating system, browser and plugins.  
[Permalink](https://pre-release.mattermost.com/core/pl/ienzppz5i3f7tbt5jiujn8uuir)

**MPG**  
`Videos/MPG.mpg`  
Expected: Generic video thumbnail, view Permalink for preview window behavior. Expected depends on the operating system, browser and plugins.  
[Permalink](https://pre-release.mattermost.com/core/pl/skggdq1hfpritc6c88bi481p5a)

**Webm**  
`Videos/WEBM.webm`  
Expected: Generic video thumbnail, view Permalink for preview window behavior. Expected depends on the operating system, browser and plugins.  
[Permalink](https://pre-release.mattermost.com/core/pl/7h8tysuxgfgsxeht3sbn7e4h6y)

**WMV**  
`Videos/WMV.wmv`  
Expected: Generic video thumbnail, view Permalink for preview window behavior. Expected depends on the operating system, browser and plugins.  
[Permalink](https://pre-release.mattermost.com/core/pl/kaom7j7uyjra7bzhrre6qwdrbw)

### Audio

**MP3**  
`Audio/MP3.mp3`  
Expected: Generic audio thumbnail & playable preview window  
[Permalink](https://pre-release.mattermost.com/core/pl/if4gn8dbrjgx8fmqmkukzefyme)

**M4A**  
`Audio/M4a.m4a`  
Expected: Generic audio thumbnail, view Permalink for preview window behavior. Expected depends on the operating system, browser and plugins.  
[Permalink](https://pre-release.mattermost.com/core/pl/6c7qsw48ybd88bktgeykodsrrc)

**AAC**  
`Audio/AAC.aac`  
Expected: Generic audio thumbnail, view Permalink for preview window behavior. Expected depends on the operating system, browser and plugins.  
[Permalink](https://pre-release.mattermost.com/core/pl/3naoy5pr5tydbk1m6yo1ast9ny)

**FLAC**  
`Audio/FLAC.flac`  
Expected: Generic audio thumbnail, view Permalink for preview window behavior. Expected depends on the operating system, browser and plugins.  
[Permalink](https://pre-release.mattermost.com/core/pl/kf4cmy44dfya5efmse7rg43eih)

**OGG**  
`Audio/OGG.ogg`  
Expected: Generic audio thumbnail, view Permalink for preview window behavior. Expected depends on the operating system, browser and plugins.  
[Permalink](https://pre-release.mattermost.com/core/pl/dezrcpbxapyexe77rjuzkrp63r)

**WAV**  
`Audio/WAV.wav`  
Expected: Generic audio thumbnail, view Permalink for preview window behavior. Expected depends on the operating system, browser and plugins.  
[Permalink](https://pre-release.mattermost.com/core/pl/pdkxx1udepdnbmi9j8kyas5xbh)

**WMA**  
`Audio/WMA.wma`  
Expected: Generic audio thumbnail, view Permalink for preview window behavior. Expected depends on the operating system, browser and plugins.  
[Permalink](https://pre-release.mattermost.com/core/pl/756wrmdd57dcig3m4emypp6i1h)
