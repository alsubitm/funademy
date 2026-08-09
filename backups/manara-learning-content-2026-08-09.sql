--
-- PostgreSQL database dump
--

\restrict bkylAks5GFD9eK5y7L6dgWMeFmIb87RQ3yMwRLrbH1gVifaOjI4j1GZpgvN9QDQ

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exercises (
    id integer NOT NULL,
    lesson_id integer NOT NULL,
    type text NOT NULL,
    prompt_ar text NOT NULL,
    prompt_en text NOT NULL,
    options text[] DEFAULT '{}'::text[] NOT NULL,
    correct_answer text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);


--
-- Name: exercises_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exercises_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exercises_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exercises_id_seq OWNED BY public.exercises.id;


--
-- Name: lessons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lessons (
    id integer NOT NULL,
    unit_id integer NOT NULL,
    title_ar text NOT NULL,
    title_en text NOT NULL,
    description_ar text DEFAULT ''::text NOT NULL,
    description_en text DEFAULT ''::text NOT NULL,
    video_url text DEFAULT ''::text NOT NULL,
    video_type text DEFAULT 'youtube'::text NOT NULL,
    duration_minutes integer DEFAULT 8 NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'published'::text NOT NULL,
    is_free_sample boolean DEFAULT false NOT NULL
);


--
-- Name: lessons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lessons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lessons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lessons_id_seq OWNED BY public.lessons.id;


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subjects (
    id integer NOT NULL,
    name_ar text NOT NULL,
    name_en text NOT NULL,
    slug text NOT NULL,
    icon text NOT NULL,
    color text NOT NULL
);


--
-- Name: subjects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subjects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subjects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subjects_id_seq OWNED BY public.subjects.id;


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id integer NOT NULL,
    subject_id integer NOT NULL,
    band text NOT NULL,
    title_ar text NOT NULL,
    title_en text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'published'::text NOT NULL
);


--
-- Name: units_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.units_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.units_id_seq OWNED BY public.units.id;


--
-- Name: exercises id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises ALTER COLUMN id SET DEFAULT nextval('public.exercises_id_seq'::regclass);


--
-- Name: lessons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons ALTER COLUMN id SET DEFAULT nextval('public.lessons_id_seq'::regclass);


--
-- Name: subjects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects ALTER COLUMN id SET DEFAULT nextval('public.subjects_id_seq'::regclass);


--
-- Name: units id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units ALTER COLUMN id SET DEFAULT nextval('public.units_id_seq'::regclass);


--
-- Data for Name: exercises; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.exercises (id, lesson_id, type, prompt_ar, prompt_en, options, correct_answer, "position") FROM stdin;
1	1	multiple_choice	في درس «نتعرف على الأعداد 1 و2 و3»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
2	1	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
3	1	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
4	1	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
5	1	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
6	2	multiple_choice	في درس «الأعداد 4 و5 و6»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
7	2	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
8	2	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
9	2	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
10	2	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
11	3	multiple_choice	في درس «الأعداد 7 و8 و9 و10»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
12	3	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
13	3	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
14	3	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
15	3	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
16	4	multiple_choice	في درس «نعد الأشياء حولنا»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
17	4	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
18	4	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
19	4	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
20	4	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
21	5	multiple_choice	في درس «الدائرة والمربع»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
22	5	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
23	5	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
24	5	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
25	5	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
26	6	multiple_choice	في درس «المثلث والمستطيل»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
27	6	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
28	6	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
29	6	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
30	6	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
31	7	multiple_choice	في درس «الأشكال في بيتنا»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
32	7	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
33	7	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
34	7	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
35	7	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
36	8	multiple_choice	في درس «نرسم بالأشكال»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
37	8	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
38	8	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
39	8	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
40	8	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
41	9	multiple_choice	في درس «ما معنى الجمع؟»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
42	9	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
43	9	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
44	9	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
45	9	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
46	10	multiple_choice	في درس «نجمع حتى 5»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
47	10	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
48	10	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
49	10	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
50	10	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
51	11	multiple_choice	في درس «نجمع حتى 10»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
52	11	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
53	11	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
54	11	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
55	11	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
56	12	multiple_choice	في درس «قصص الجمع»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
57	12	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
58	12	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
59	12	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
60	12	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
61	13	multiple_choice	في درس «جدول الضرب 2 و3»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
62	13	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
63	13	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
64	13	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
65	13	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
66	14	multiple_choice	في درس «جدول الضرب 4 و5»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
67	14	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
68	14	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
69	14	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
70	14	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
71	15	multiple_choice	في درس «مفهوم القسمة»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
72	15	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
73	15	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
74	15	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
75	15	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
76	16	multiple_choice	في درس «الضرب والقسمة معاً»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
77	16	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
78	16	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
79	16	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
80	16	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
81	17	multiple_choice	في درس «ما هو الكسر؟»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
82	17	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
83	17	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
84	17	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
85	17	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
86	18	multiple_choice	في درس «مقارنة الكسور»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
87	18	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
88	18	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
89	18	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
90	18	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
91	19	multiple_choice	في درس «جمع الكسور المتشابهة»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
92	19	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
93	19	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
94	19	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
95	19	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
96	20	multiple_choice	في درس «الكسور في حياتنا»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
97	20	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
98	20	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
99	20	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
100	20	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
101	21	multiple_choice	في درس «وحدات الطول»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
102	21	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
103	21	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
104	21	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
105	21	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
106	22	multiple_choice	في درس «المحيط»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
107	22	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
108	22	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
109	22	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
110	22	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
111	23	multiple_choice	في درس «المساحة»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
112	23	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
113	23	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
114	23	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
115	23	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
116	24	multiple_choice	في درس «الزوايا»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
117	24	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
118	24	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
119	24	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
120	24	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
121	25	multiple_choice	في درس «حرف الألف والباء»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
122	25	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
123	25	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
124	25	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
125	25	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
126	26	multiple_choice	في درس «حرف التاء والثاء»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
127	26	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
128	26	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
129	26	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
130	26	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
131	27	multiple_choice	في درس «حرف الجيم والحاء»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
132	27	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
133	27	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
134	27	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
135	27	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
136	28	multiple_choice	في درس «حرف الخاء ومراجعة»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
137	28	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
138	28	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
139	28	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
140	28	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
141	29	multiple_choice	في درس «حرف الدال والذال»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
142	29	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
143	29	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
144	29	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
145	29	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
146	30	multiple_choice	في درس «حرف الراء والزاي»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
147	30	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
148	30	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
149	30	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
150	30	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
151	31	multiple_choice	في درس «حرف السين والشين»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
152	31	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
153	31	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
154	31	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
155	31	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
156	32	multiple_choice	في درس «حرف الصاد»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
157	32	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
158	32	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
159	32	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
160	32	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
161	33	multiple_choice	في درس «أفراد عائلتي»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
162	33	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
163	33	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
164	33	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
165	33	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
166	34	multiple_choice	في درس «ألوان حولي»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
167	34	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
168	34	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
169	34	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
170	34	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
171	35	multiple_choice	في درس «حيوانات أحبها»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
172	35	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
173	35	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
174	35	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
175	35	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
176	36	multiple_choice	في درس «جملتي الأولى»: كم عدد التفاحات في الصورة؟ 🍎🍎🍎	How many apples?	{2,3,4,5}	3	0
177	36	picture_select	اختر الشكل الصحيح: الدائرة	Pick the circle	{دائرة,مربع,مثلث,نجمة}	دائرة	1
178	36	multiple_choice	ما ناتج 2 + 1؟	What is 2 + 1?	{1,2,3,4}	3	2
179	36	fill_blank	أكمل: واحد، اثنان، ____	Complete: one, two, ___	{}	ثلاثة	3
180	36	matching	صل العدد بالصورة	Match number to picture	{1=🍎,2=🍎🍎,3=🍎🍎🍎}	1=🍎|2=🍎🍎|3=🍎🍎🍎	4
181	37	multiple_choice	في درس «قصة الصياد والسمكة»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
182	37	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
183	37	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
184	37	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
185	37	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
186	38	multiple_choice	في درس «الفكرة الرئيسية»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
187	38	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
188	38	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
189	38	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
190	38	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
191	39	multiple_choice	في درس «التفاصيل المهمة»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
192	39	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
193	39	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
194	39	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
195	39	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
196	40	multiple_choice	في درس «نستنتج ونتوقع»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
197	40	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
198	40	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
199	40	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
200	40	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
201	41	multiple_choice	في درس «الاسم والفعل والحرف»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
202	41	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
203	41	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
204	41	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
205	41	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
206	42	multiple_choice	في درس «الجملة الاسمية»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
207	42	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
208	42	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
209	42	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
210	42	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
211	43	multiple_choice	في درس «الجملة الفعلية»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
212	43	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
213	43	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
214	43	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
215	43	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
216	44	multiple_choice	في درس «أدوات الاستفهام»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
217	44	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
218	44	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
219	44	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
220	44	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
221	45	multiple_choice	في درس «التاء المربوطة والمفتوحة»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
222	45	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
223	45	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
224	45	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
225	45	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
226	46	multiple_choice	في درس «همزة القطع والوصل»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
227	46	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
228	46	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
229	46	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
230	46	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
231	47	multiple_choice	في درس «اللام الشمسية والقمرية»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
232	47	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
233	47	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
234	47	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
235	47	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
236	48	multiple_choice	في درس «أكتب فقرة قصيرة»: ما ناتج 3 × 4؟	What is 3 × 4?	{7,10,12,14}	12	0
237	48	multiple_choice	أي كسر أكبر؟	Which fraction is bigger?	{النصف,الربع,الثمن,العشر}	النصف	1
238	48	fill_blank	أكمل: 5 × 5 = ____	Complete: 5 × 5 = ___	{}	25	2
239	48	multiple_choice	اختر الجملة الاسمية:	Pick the nominal sentence	{"السماء صافية","ذهب الولد","اكتب الدرس","هل جئت؟"}	السماء صافية	3
240	48	matching	صل العملية بناتجها	Match operation to result	{2×3=6,4×2=8,5×2=10}	2×3=6|4×2=8|5×2=10	4
\.


--
-- Data for Name: lessons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lessons (id, unit_id, title_ar, title_en, description_ar, description_en, video_url, video_type, duration_minutes, "position", status, is_free_sample) FROM stdin;
1	1	نتعرف على الأعداد 1 و2 و3	Meet numbers 1, 2, 3	نعد الأشياء من حولنا ونتعلم شكل الأعداد الأولى.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	0	published	t
2	1	الأعداد 4 و5 و6	Numbers 4, 5, 6	نكمل رحلة العد مع ألعاب ممتعة.		https://www.youtube.com/watch?v=fJ9rUzIMcZQ	youtube	8	1	published	f
3	1	الأعداد 7 و8 و9 و10	Numbers 7 to 10	نصل إلى العشرة ونحتفل بالعد الكامل.		https://www.youtube.com/watch?v=kXYiU_JCYtU	youtube	10	2	published	f
4	1	نعد الأشياء حولنا	Counting around us	نستخدم الأعداد في حياتنا اليومية.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	3	published	f
5	2	الدائرة والمربع	Circle and square	نتعرف على أول شكلين هندسيين.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	0	published	f
6	2	المثلث والمستطيل	Triangle and rectangle	أشكال جديدة نراها كل يوم.		https://www.youtube.com/watch?v=fJ9rUzIMcZQ	youtube	8	1	published	f
7	2	الأشكال في بيتنا	Shapes at home	نبحث عن الأشكال في غرفتنا ومطبخنا.		https://www.youtube.com/watch?v=kXYiU_JCYtU	youtube	10	2	published	f
8	2	نرسم بالأشكال	Drawing with shapes	نصنع لوحة جميلة من الأشكال.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	3	published	f
9	3	ما معنى الجمع؟	What is addition?	نجمع الأشياء معاً ونعدها.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	0	published	f
10	3	نجمع حتى 5	Adding up to 5	تمارين جمع سهلة وممتعة.		https://www.youtube.com/watch?v=fJ9rUzIMcZQ	youtube	8	1	published	f
11	3	نجمع حتى 10	Adding up to 10	نتحدى أنفسنا بأعداد أكبر.		https://www.youtube.com/watch?v=kXYiU_JCYtU	youtube	10	2	published	f
12	3	قصص الجمع	Addition stories	مسائل كلامية من حياة الأطفال.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	3	published	f
13	4	جدول الضرب 2 و3	Times tables 2 & 3	نحفظ الجداول الأولى بطريقة ذكية.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	0	published	t
14	4	جدول الضرب 4 و5	Times tables 4 & 5	نكمل الجداول مع تمارين سريعة.		https://www.youtube.com/watch?v=fJ9rUzIMcZQ	youtube	8	1	published	f
15	4	مفهوم القسمة	Understanding division	القسمة هي التوزيع بالعدل.		https://www.youtube.com/watch?v=kXYiU_JCYtU	youtube	10	2	published	f
16	4	الضرب والقسمة معاً	Multiply & divide	العلاقة بين العمليتين.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	3	published	f
17	5	ما هو الكسر؟	What is a fraction?	نقسم البيتزا ونتعلم الأنصاف والأرباع.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	0	published	f
18	5	مقارنة الكسور	Comparing fractions	أيهما أكبر: النصف أم الربع؟		https://www.youtube.com/watch?v=fJ9rUzIMcZQ	youtube	8	1	published	f
19	5	جمع الكسور المتشابهة	Adding like fractions	نجمع كسوراً لها نفس المقام.		https://www.youtube.com/watch?v=kXYiU_JCYtU	youtube	10	2	published	f
20	5	الكسور في حياتنا	Fractions in life	الوقت والنقود والطبخ كلها كسور.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	3	published	f
21	6	وحدات الطول	Units of length	السنتيمتر والمتر والكيلومتر.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	0	published	f
22	6	المحيط	Perimeter	نقيس حدود الأشكال.		https://www.youtube.com/watch?v=fJ9rUzIMcZQ	youtube	8	1	published	f
23	6	المساحة	Area	كم مربعاً يغطي الشكل؟		https://www.youtube.com/watch?v=kXYiU_JCYtU	youtube	10	2	published	f
24	6	الزوايا	Angles	قائمة وحادة ومنفرجة.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	3	published	f
25	7	حرف الألف والباء	Alif & Baa	أول حرفين في رحلتنا مع كلمات مصورة.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	0	published	t
26	7	حرف التاء والثاء	Taa & Thaa	نميز بين النقاط ونكتب الحروف.		https://www.youtube.com/watch?v=fJ9rUzIMcZQ	youtube	8	1	published	f
27	7	حرف الجيم والحاء	Jeem & Haa	حروف جديدة مع أناشيد ممتعة.		https://www.youtube.com/watch?v=kXYiU_JCYtU	youtube	10	2	published	f
28	7	حرف الخاء ومراجعة	Khaa & review	نراجع كل ما تعلمناه بلعبة شيقة.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	3	published	f
29	8	حرف الدال والذال	Dal & Thal	نتعلم النطق الصحيح والكتابة.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	0	published	f
30	8	حرف الراء والزاي	Raa & Zay	حروف متشابهة نفرق بينها.		https://www.youtube.com/watch?v=fJ9rUzIMcZQ	youtube	8	1	published	f
31	8	حرف السين والشين	Seen & Sheen	ثلاث نقاط تصنع الفرق.		https://www.youtube.com/watch?v=kXYiU_JCYtU	youtube	10	2	published	f
32	8	حرف الصاد	Saad	حرف قوي مع كلمات جديدة.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	3	published	f
33	9	أفراد عائلتي	My family	بابا وماما وأخي وأختي.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	0	published	f
34	9	ألوان حولي	Colors around me	أحمر وأزرق وأخضر وأصفر.		https://www.youtube.com/watch?v=fJ9rUzIMcZQ	youtube	8	1	published	f
35	9	حيوانات أحبها	Animals I love	أسد وقطة وجمل وخروف.		https://www.youtube.com/watch?v=kXYiU_JCYtU	youtube	10	2	published	f
36	9	جملتي الأولى	My first sentence	نركب كلمات لنصنع جملة.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	3	published	f
37	10	قصة الصياد والسمكة	The fisherman story	نقرأ قصة ونجيب عن الأسئلة.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	0	published	t
38	10	الفكرة الرئيسية	Main idea	كيف نجد فكرة النص الرئيسية؟		https://www.youtube.com/watch?v=fJ9rUzIMcZQ	youtube	8	1	published	f
39	10	التفاصيل المهمة	Key details	نبحث عن التفاصيل الداعمة.		https://www.youtube.com/watch?v=kXYiU_JCYtU	youtube	10	2	published	f
40	10	نستنتج ونتوقع	Inference	نقرأ بين السطور.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	3	published	f
41	11	الاسم والفعل والحرف	Noun, verb, particle	أقسام الكلام الثلاثة.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	0	published	f
42	11	الجملة الاسمية	Nominal sentence	المبتدأ والخبر.		https://www.youtube.com/watch?v=fJ9rUzIMcZQ	youtube	8	1	published	f
43	11	الجملة الفعلية	Verbal sentence	الفعل والفاعل.		https://www.youtube.com/watch?v=kXYiU_JCYtU	youtube	10	2	published	f
44	11	أدوات الاستفهام	Question words	من وماذا ومتى وأين ولماذا.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	3	published	f
45	12	التاء المربوطة والمفتوحة	Taa marbuta	متى نكتب ة ومتى نكتب ت؟		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	0	published	f
46	12	همزة القطع والوصل	Hamza rules	قاعدة سهلة نطبقها دائماً.		https://www.youtube.com/watch?v=fJ9rUzIMcZQ	youtube	8	1	published	f
47	12	اللام الشمسية والقمرية	Sun & moon letters	الفرق في النطق والكتابة.		https://www.youtube.com/watch?v=kXYiU_JCYtU	youtube	10	2	published	f
48	12	أكتب فقرة قصيرة	Writing a paragraph	نرتب أفكارنا ونكتبها.		https://www.youtube.com/watch?v=Xn9SC7EowXA	youtube	6	3	published	f
\.


--
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subjects (id, name_ar, name_en, slug, icon, color) FROM stdin;
1	الرياضيات	Math	math	calculator	#2563EB
2	اللغة العربية	Arabic	arabic	book-open	#059669
3	اللغة الإنجليزية	English	english	languages	#D97706
4	العلوم	Science	science	flask-conical	#7C3AED
\.


--
-- Data for Name: units; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.units (id, subject_id, band, title_ar, title_en, "position", status) FROM stdin;
3	1	explorers	الجمع البسيط	Simple addition	2	published
4	1	builders	الضرب والقسمة	Multiplication & division	0	published
5	1	builders	الكسور	Fractions	1	published
6	1	builders	القياس والهندسة	Measurement & geometry	2	published
7	2	explorers	الحروف الهجائية (أ - خ)	Letters A–Kh	0	published
8	2	explorers	الحروف الهجائية (د - ص)	Letters D–S	1	published
9	2	explorers	كلماتي الأولى	My first words	2	published
10	2	builders	القراءة والفهم	Reading comprehension	0	published
11	2	builders	قواعد النحو الأساسية	Basic grammar	1	published
12	2	builders	الإملاء والكتابة	Spelling & writing	2	published
2	1	explorers	الأشكال الهندسية	Shapes	1	published
1	1	explorers	الأعداد من 1 إلى 10	Numbers 1–10	0	published
\.


--
-- Name: exercises_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.exercises_id_seq', 241, true);


--
-- Name: lessons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lessons_id_seq', 48, true);


--
-- Name: subjects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.subjects_id_seq', 4, true);


--
-- Name: units_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.units_id_seq', 12, true);


--
-- Name: exercises exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);


--
-- Name: lessons lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_pkey PRIMARY KEY (id);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: subjects subjects_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_slug_unique UNIQUE (slug);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: exercises exercises_lesson_id_lessons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_lesson_id_lessons_id_fk FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE CASCADE;


--
-- Name: lessons lessons_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;


--
-- Name: units units_subject_id_subjects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_subject_id_subjects_id_fk FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict bkylAks5GFD9eK5y7L6dgWMeFmIb87RQ3yMwRLrbH1gVifaOjI4j1GZpgvN9QDQ

