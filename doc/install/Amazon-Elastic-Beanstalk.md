
## AWS Elastic Beanstalk Setup (Docker)
These instructions will guide you through the process of setting up an Elastic Beanstalk single-docker instance of Mattermost for product evaluation.

1. From your [AWS console]( https://console.aws.amazon.com/console/home) select **Elastic Beanstalk** under the Compute section.
2. Select **Create New Application** from the top right.
3. Name your Elastic Beanstalk application and click **Next**, then choose **Create web server**.
4. If asked, select **Create an IAM role and instance profile**, then click **Next**.
5. From the Predefined Configuration drop-down list, select **Docker** under the generic heading. From the Environment Type drop-down list, select **Single instance**.
6. For Application Source, select **Upload your own** and upload the [Dockerrun.aws.zip](https://github.com/mattermost/platform/raw/master/docker/1.0/Dockerrun.aws.zip) file. Click **Next** and wait while AWS uploads the application version.
7. Type an Environment Name and URL. Make sure the URL is available by clicking **Check availability**, then click **Next**.
8. The options on the Additional Resources page may be left at default unless you wish to change them. Click **Next**.
9. On the Configuration Details page, select an Instance Type of **t2.small**. Instance types comprise varying combinations of CPU, memory, storage, and networking capacity. You may select larger T2 instance types if required.
10. Also on the Configuration Details page, under the Health Reporting section, change System Type to **Basic**. The remaining options may be left at their default values unless you wish to change them. Click **Next**.
11. Environment tags may be left blank. Click **Next**.
12. You will be asked to review your information, then click **Launch**. It may take a few minutes for beanstalk to launch your environment. If the launch is successful, you will see a see a large green checkmark and the Health status should change to “Green”. 
13. Test your environment by clicking the domain link next to your application name at the top of the dashboard. Alternatively, enter the domain into your browser in the form `http://<your-ebs-application-url>.elasticbeanstalk.com`. You can also map your own domain if you wish. If everything is working correctly, the domain should navigate you to the Mattermost signup page. Enjoy exploring Mattermost!
	
### (Recommended) Enable Email 
The default single-container Docker instance for Mattermost is designed for product evaluation, and sets `SendEmailNotifications=false` so the product can function without enabling email. To see the product's full functionality, [enabling SMTP email is recommended](SMTP-Email-Setup.md).
