
## AWS Elastic Beanstalk Setup (Docker)
These instructions will guide you through the process of setting up Mattermost for product evaluation using an EBS Docker single-container application using [Dockerrun.aws.zip](https://github.com/mattermost/platform/raw/master/docker/1.1/Dockerrun.aws.zip).

1. From your [AWS console]( https://console.aws.amazon.com/console/home) select **Elastic Beanstalk** under the Compute section.
2. Select **Create New Application** from the top right.
3. Name your Elastic Beanstalk application and click **Next**, 
4. Select **Create web server** on the New Enviroment page.
5. If asked, select **Create an IAM role and instance profile**, then click **Next**.
6. On the Enviroment Type page,
	1. Set Predefined Configuration to **Docker** under the generic heading in the drop-down list. 
	2. Set Environment Type to **Single instance** in the drop-down list.
	3. Click **Next**.
7. For Application Source, select **Upload your own** and upload the [Dockerrun.aws.zip](https://github.com/mattermost/platform/raw/master/docker/1.1/Dockerrun.aws.zip) file, then click **Next**.
8. Type an Environment Name and URL. Make sure the URL is available by clicking **Check availability**, then click **Next**.
9. The options on the Additional Resources page may be left at default unless you wish to change them. Click **Next**.
10. On the Configuration Details page, 
	1. Select an Instance Type of **t2.small** or larger.
	2. The remaining options may be left at their default values unless you wish to change them. Click **Next**.
11. Environment tags may be left blank. Click **Next**.
12. You will be asked to review your information, then click **Launch**.
14. It may take a few minutes for beanstalk to launch your environment. If the launch is successful, you will see a see a large green checkmark and the Health status should change to “Green”. 
15. Test your environment by clicking the domain link next to your application name at the top of the dashboard. Alternatively, enter the domain into your browser in the form `http://<your-ebs-application-url>.elasticbeanstalk.com`. You can also map your own domain if you wish. If everything is working correctly, the domain should navigate you to the Mattermost signup page. Enjoy exploring Mattermost!
	
### (Recommended) Enable Email 
The default single-container Docker instance for Mattermost is designed for product evaluation, and sets `SendEmailNotifications=false` so the product can function without enabling email. To see the product's full functionality, [enabling SMTP email is recommended](SMTP-Email-Setup.md).
