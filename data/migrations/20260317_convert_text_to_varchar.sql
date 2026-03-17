begin;

alter table items
  alter column slug type varchar(220),
  alter column title type varchar(200),
  alter column description type varchar(5000),
  alter column category type varchar(80),
  alter column condition type varchar(80),
  alter column location_area type varchar(120),
  alter column status type varchar(20);

alter table item_images
  alter column image_url type varchar(500);

alter table leads
  alter column buyer_name type varchar(80),
  alter column phone type varchar(10),
  alter column email type varchar(160),
  alter column message type varchar(1000);

alter table contact_submissions
  alter column buyer_name type varchar(80),
  alter column phone type varchar(10),
  alter column email type varchar(160),
  alter column location type varchar(100),
  alter column message type varchar(1200),
  alter column captcha_prompt type varchar(160);

commit;
