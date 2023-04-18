--
-- PostgreSQL database dump
--

-- Dumped from database version 10.20 (Debian 10.20-1.pgdg90+1)
-- Dumped by pg_dump version 14.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';

--
-- Data for Name: focalboard_system_settings; Type: TABLE DATA; Schema: public; Owner: mmuser
--

INSERT INTO public.focalboard_system_settings VALUES ('UniqueIDsMigrationComplete', 'true');
INSERT INTO public.focalboard_system_settings VALUES ('TeamLessBoardsMigrationComplete', 'true');
INSERT INTO public.focalboard_system_settings VALUES ('DeletedMembershipBoardsMigrationComplete', 'true');
INSERT INTO public.focalboard_system_settings VALUES ('CategoryUuidIdMigrationComplete', 'true');
INSERT INTO public.focalboard_system_settings VALUES ('DeDuplicateCategoryBoardTableComplete', 'true');


--
-- PostgreSQL database dump complete
--
