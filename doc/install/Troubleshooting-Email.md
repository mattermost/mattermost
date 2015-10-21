
change settings via system console

known good settings for providers:
amazon ses
postfix
gmail
hotmail
sendgrid

if you fill in a username/password you must use a secure connection like TLS or STARTTLS

test connection
check error logs
search for specific smtp errors like '555' with your provider.

Adv Email trouble shooting
from the machine (if docker then exec)
run telnet to make sure host/port is correct
issue ELHO cmd to see if you can see stuff like STARTTSL

