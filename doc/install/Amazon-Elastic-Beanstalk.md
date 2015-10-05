
## AWS Elastic Beanstalk Setup (Docker)

1. Create a new Elastic Beanstalk Docker application using the [Dockerrun.aws.zip](https://github.com/mattermost/platform/raw/master/docker/1.0/Dockerrun.aws.zip) file provided. 
	1. From the AWS console select Elastic Beanstalk.
	2. Select "Create New Application" from the top right.
	3. Name the application and press next.
	4. Select "Create a web server" environment.
	5. If asked, select create an IAM role and instance profile and press next.
	6. For predefined configuration select under Generic: Docker. For environment type select single instance.
	7. For application source, select upload your own and upload Dockerrun.aws.zip from [Dockerrun.aws.zip](https://github.com/mattermost/platform/raw/master/docker/1.0/Dockerrun.aws.zip). Everything else may be left at default.
	8. Select an environment name, this is how you will refer to your environment. Make sure the URL is available then press next.
	9. The options on the additional resources page may be left at default unless you wish to change them. Press Next.
	10. On the configuration details place. Select an instance type of t2.small or larger.
	11. You can set the configuration details as you please but they may be left at their defaults. When you are done press next.
	12. Environment tags my be left blank. Press next.
	13. You will be asked to review your information. Press Launch.

4. Try it out!
	14. Wait for beanstalk to update the environment.
	15. Try it out by entering the domain of the form \*.elasticbeanstalk.com found at the top of the dashboard into your browser. You can also map your own domain if you wish.
	
	
	### (Recommended) Enable Email 
	The default single-container Docker instance for Mattermost is designed for product evaluation, and sets `ByPassEmail=true` so the product can run without enabling email, when doing so maybe difficult. 
	
	To see the product's full functionality, [enabling SMTP email is recommended](SMTP-Email-Setup.md).
