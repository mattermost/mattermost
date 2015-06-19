**Mattermost Preview**  
**Team Communication Service**  
**Version 0.40**

What matters most to your team?
===============================

Words have power.  
Mattermost serves teams who use words to shape the future.  
The words you choose are up to you.

*- SpinPunch*

Installing the Mattermost Preview 
=================================

You're installing "Mattermost Preview", a pre-released 0.40 version intended for an early look at what we're building. While SpinPunch runs this version internally, it's not recommended for production deployments since we can't guarantee API stability or backwards compatibility until our 1.0 version release. 

That said, any issues at all, please let us know on the Mattermost forum at: http://bit.ly/1MY1kul

Developer Machine Setup (Docker/Mac)
------------------------------------

1. Follow the instructions at http://docs.docker.com/installation/mac/  
    1. Use the Boot2Docker command-line utility  
    2. If you do command-line setup use: `boot2docker init eval “$(boot2docker shellinit)”`  
2. Get your Docker IP address with `boot2docker ip`
3. Add a line to your /etc/hosts that goes `<Docker IP> dockerhost`
4. Run `boot2docker shellinit` and copy the export statements to your ~/.bash_profile
5. Run `docker run --name mattermost-dev -d --publish 8065:80 mattermost/platform:helium`
6. When docker is done fetching the image, open http://dockerhost:8065/ in your browser

If you want to work with the latest bits in the repo you can run the cmd `docker run --name mattermost-dev -d --publish 8065:80 mattermost/platform:latest`
You can update to the latest bits by running `docker pull mattermost/platform:latest`

If you wish to remove mattermost-dev use the following commands
1. docker stop mattermost-dev
2. docker rm -v mattermost-dev

AWS Elastic Beanstalk Setup (Docker)
------------------------------------

1. From the AWS console select Elastic Beanstalk 
2. Select "Create New Application" from the top right. 
3. Name the application and press next 
4. Select "Create a web server" environment. 
5. If asked, select create and AIM role and instance profile and press next. 
6. For predefined configuration select docker. Environment type may be left at default. 
7. For application source, select upload your own and upload Dockerrun.aws.json from docker/Dockerrun.aws.json. Everything else may be left at default. 
8. Select an environment name, this is how you will refer to your environment. Make sure the URL is available then press next. 
9. The options on the additional resources page may be left at default unless you wish to change them. Press Next. 
10. On the configuration details place. Select an instance type of t2.small or larger. 
11. You can set the configuration details as you please but they may be left at their defaults. When you are done press next. 
12. Environment tags my be left blank. Press next. 
13. You will be asked to review your information. Press Launch. 
14. Up near the top of the dashboard you will see a domain of the form \*.elasticbeanstalk.com copy this as you will need it later. 

15. From the AWS console select route 53 
16. From the sidebar select Hosted Zones 
17. Select the domain you want to use or create a new one. 
18. Modify an existing CNAME record set or create a new one with the name * and the value of the domain you copied in step 13. 
19. Save the record set 

20. Return the Elastic Beanstalk from the AWS console. 
21. Select the environment you created. 
22. Select configuration from the sidebar. 
23. Click the gear beside software configuration. 
24. Add an environment property with the name “MATTERMOST\_DOMAIN” and a value of the domain you mapped in route 53. For example if your domain is \*.example.com you would enter example.com not www.example.com. 
25. Select apply. 
26. Return to the dashboard on the sidebar and wait for beanstalk update the environment. 
27. Try it out by entering the domain you mapped into your browser.

License
-------

This software uses the Apache 2.0 open source license. For more details see: http://bit.ly/1Lc25Sv  


**XXXXXX TODO: Test install procedures**
