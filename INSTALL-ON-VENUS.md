# Installing signalk-server on Venus 

First of all, note that there are two types of install: install signalk server,
and this plugin, on another machine. In that situation the plugin connects, over
the ethernet/wifi network, to the Venus device for data retrieval. See README.md
for that method.

This document explains an alternative: installing nodejs, signalk-server and this
plugin onto the Venus device itself, eliminating the need for a separate box.

### Diskspace

The CCGX does not have enough diskspace at all, but it can be installed on an 
sdcard.

The Venus GX has enough, but not in the rootfs. In /scratch there is a spare 
partition with 2.5GB available.

The raspberrypi might have enough diskspace.

Steps to install outside the rootfs on a Venus GX:

- `mkdir /scratch/signalk`
- Add a line with `dest signalk /scratch/signalk` to `/etc/opkg/opkg.conf`
- Add the second `/usr/bin` dir to the path in `/etc/profile`

Then to all opkg commands add `-d signalk`, which specifies an alternate destination.

For the CCGX you could the same, but then on an sdcard. Note that most sdcards
will be formatted with vfat, which doesn't support the (required) symlinks. So re-
format the partition to ext3 or ext4 for example. mkfs.ext4 is installed on the ccgx.

### Installing the dependencies

Raspberrypis: take & install the cortexa7hf files.
CCGX & Venus GX: take & install the cortexa8hf files.

The files are in the [/venus-ipks](/venus-ipks) folder in this repo.

```
libssl1.0.0_1.0.2h-r0_cortexa7hf-vfp-vfpv4-neon.ipk
libcrypto1.0.0_1.0.2h-r0_cortexa7hf-vfp-vfpv4-neon.ipk
nodejs_6.12.0-r1.7_cortexa7hf-vfp-vfpv4-neon.ipk
nodejs-npm_6.12.0-r1.7_cortexa7hf-vfp-vfpv4-neon.ipk
```

Login to the target and install the packages:

```
ssh root@192.168.178.57

opkg update
opkg install ./libcrypto1.0.0_1.0.2h-r0_cortexa7hf-vfp-vfpv4-neon.ipk
opkg install ./libssl1.0.0_1.0.2h-r0_cortexa7hf-vfp-vfpv4-neon.ipk
opkg install ./nodejs_6.12.0-r1.7_cortexa7hf-vfp-vfpv4-neon.ipk
opkg install ./nodejs-npm_6.12.0-r1.7_cortexa7hf-vfp-vfpv4-neon.ipk
```

Besides those packages that are not (yet) available from the Venus OS opkg
feed, there are also some that are available. They need and can be installed
without copying around packages yourself:

```
# git is required by npm when downloading from github
opkg install git

# MVA 2018-02-01: outcommented this one, the idea is that all npm packages
# should now have been fixed to no longer require git-submodules.
# git-perltools includes git-submodule, which is required by npm
#opkg install git-perltools
```

### Installing signalk server

```
npm install git+https://github.com/SignalK/signalk-server-node.git
```


### Some notes on required diskspace, needs to be amended and calculated

```
# At the start (ipks downloaded to data dir)
#
# root@raspberrypi2:/data/home/root# df
# Filesystem           1K-blocks      Used Available Use% Mounted on
# /dev/root               265482    185371     61884  75% /
# devtmpfs                469432         4    469428   0% /dev
# tmpfs                   473824       192    473632   0% /run
# tmpfs                   473824       168    473656   0% /var/volatile
# /dev/mmcblk0p1           40862     12370     28492  30% /u-boot
# /dev/mmcblk0p4         1889740     12368   1763328   1% /data


# After installing all, except git-perltools
# root@raspberrypi2:/data/home/root# df
# Filesystem           1K-blocks      Used Available Use% Mounted on
# /dev/root               265482    238181      9074  96% /
# devtmpfs                469432         4    469428   0% /dev
# tmpfs                   473824       196    473628   0% /run
# tmpfs                   473824       168    473656   0% /var/volatile
# /dev/mmcblk0p1           40862     12370     28492  30% /u-boot
# /dev/mmcblk0p4         1889740     12424   1763272   1% /data


# After removing git, nodejs and nodejs-npm
#
# Filesystem           1K-blocks      Used Available Use% Mounted on
# /dev/root               265482    203506     43749  82% /
# devtmpfs                469432         4    469428   0% /dev
# tmpfs                   473824       196    473628   0% /run
# tmpfs                   473824       168    473656   0% /var/volatile
# /dev/mmcblk0p1           40862     12370     28492  30% /u-boot
# /dev/mmcblk0p4         1889740     12428   1763268   1% /data


# After installing git & git-perltools on data
#
# root@raspberrypi2:/data# df
# Filesystem           1K-blocks      Used Available Use% Mounted on
# /dev/root               265482    205222     42033  83% /
# devtmpfs                469432         4    469428   0% /dev
# tmpfs                   473824       196    473628   0% /run
# tmpfs                   473824       168    473656   0% /var/volatile
# /dev/mmcblk0p1           40862     12370     28492  30% /u-boot
# /dev/mmcblk0p4         1889740     29624   1746072   2% /data


# After installing also nodejs & node-npm on data
#
# root@raspberrypi2:/data/home/root# df
# Filesystem           1K-blocks      Used Available Use% Mounted on
# /dev/root               265482    210077     37178  85% /
# devtmpfs                469432         4    469428   0% /dev
# tmpfs                   473824       196    473628   0% /run
# tmpfs                   473824       168    473656   0% /var/volatile
# /dev/mmcblk0p1           40862     12370     28492  30% /u-boot
# /dev/mmcblk0p4         1889740     59984   1715712   3% /data

and now it was time to install signalk server but apparently I was
interrupted before completing that; a while back.
```
