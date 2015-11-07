## Software Requirements

### Web Client

Supported Operating Systems and Browsers for the Mattermost Web Client include: 

- PC: Windows 7, Windows 8 (Chrome 43+, Firefox 38+, Internet Explorer 10+)  
- Mac: OS 10 (Safari 7, Chrome 43+)  
- Linux: Arch 4.0.0  (Chrome 43+)  
- iPhone 4s and higher (Safari on iOS 8.3+, Chrome 43+)  
- Android 5 and higher (Chrome 43+)  

### Email Client

Supported Email Clients for rendering Mattermost email notifications include:

Web based clients: 
- Gmail
- Office 365
- Outlook
- Yahoo
- AOL

Desktop Clients:
- Apple Mail version 7+
- Outlook 2016+
- Thunderbird 38.2+

Mobile Clients: 
- Gmail Mobile App (Android, iOS)
- iOS Mail App (iOS 7+)
- Blackberry Mail App  (OS version 4+)

### Server

Supported Operating Systems for the Mattermost Server include: 

- Ubuntu
- Debian
- CentOS
- RedHat Enterprise Linux
- Oracle Linux

The Mattermost roadmap does not currently include production support for Fedora, FreeBSD or Arch Linux. 

## Hardware Requirements

Mattermost offers both real-time communication and file sharing. CPU and Memory requirements are typically driven by the number of concurrent users using real-time messaging. Storage requirements are typically driven by number and size of files shared. 

The below guidelines offer estimates based on real world usage of Mattermost in multi-team configurations ranging from 10-100 users per team. 

### CPU

- 2 cores is the recommended number of cores and supports up to 250 users
- 4 cores supports up to 1,000 users
- 8 cores supports up to 2,500 users
- 16 cores supports up to 5,000 users
- 32 cores supports up to 10,000 users
- 64 cores supports up to 20,000 users

### Memory

- 2GB RAM is the recommended memory size and supports up to 50 users
- 4GB RAM supports up to 500 users
- 8GB RAM supports up to 1,000 users
- 16GB RAM supports up to 2,000 users
- 32GB RAM supports up to 4,000 users
- 64GB RAM supports up to 8,000 users
- 128GB RAM supports up to 16,000 users

### Storage 

To estimate initial storage requirements, begin with a Mattermost server approximately 600 MB to 800 MB in size including operating system and database, then add the multiplied product of:

- Estimated storage per user per month (see below), multipled by 12 months in a year
- Estimated mean average number of users in a year
- A 1-2x safety factor

**Estimated storage per user per month**

File usage per user varies significantly across industries. The below benchmarks are recommended: 

- **Low usage teams** (1-5 MB/user/month) - Primarily use text-messages and links to communicate. Examples would include software development teams that heavily use web-based document creation and management tools, and therefore rarely upload files to the server. 
 
- **Medium usage teams** (5-25 MB/user/month) - Use a mix of text-messages as well as shared documents and images to communicate. Examples might include business teams that may commonly drag and drop screenshots, PDFs and Microsoft Office documents into Mattermost for sharing and review. 

- **High usage teams** - (25-100 MB/user/month) - Heaviest utlization comes from teams uploading a high number of large files into Mattermost on a regular basis. Examples include creative teams who share and store artwork and media with tags and commentary in a pipeline production process. 
 
*Example:* A 30-person team with medium usage (5-25 MB/user/month) with a safety factor of 2x would require between 300 MB (30 users * 5 MB * 2x safety factor) and 1500 MB (30 users * 25 MB * 2x safety factor) of free space in the next year. 

It's recommended to review storage utilization at least quarterly to ensure adequate free space is available. 
