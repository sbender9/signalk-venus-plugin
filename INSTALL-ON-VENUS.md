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
npm install -g --unsafe-perm signalk-server
```

### Full process of installing the signalk server and the venus plugin on a CCGX
```
# Insert a sdcard into the CCGX and formart it as ext4. 
# Stop the vrmlogger service to unlock the partition
svc -d /service/vrmlogger

# Umount the partition
umount /media/mmcblk0p1

# Format it as ext4
mkfs.ext4 /dev/mmcblk0p1

# Mount the partition and create the necessary directories
mount /dev/mmcblk0p1 /media/mmcblk0p1
cd /media/mmcblk0p1
mkdir signalk
mkdir tmp

# Edit the opkg config /etc/opkg/opkg.conf
# and add the following line to create a new destination
dest signalk /media/mmcblk0p1/signalk

# Edit /etc/profile and modify the PATH enviroment variable to include
# the previouly created opkg destination
PATH="/usr/local/bin:/usr/bin:/bin:/media/mmcblk0p1/signalk/usr/bin"

# Install nodejs and npm packages
opkg -d signalk install libcrypto1.0.0_1.0.2h-r0_cortexa8hf-vfp-neon.ipk
opkg -d signalk install libssl1.0.0_1.0.2h-r0_cortexa8hf-vfp-neon.ipk
opkg -d signalk install nodejs_8.4.0-r0_cortexa8hf-vfp-neon.ipk
opkg -d signalk install nodejs-npm_8.4.0-r0_cortexa8hf-vfp-neon.ipk

# This packages will be need later to build some of the signalsk-server 
# dependencies (bcrypto) and for installing the venus signalk plugin
opkg install packagegroup-core-buildessential  python-compiler python-misc git-perltools

# Configure npm to use the sdcard for the cache files
npm config set cache /media/mmcblk0p1/tmp/.npm

# npm uses a large amount of RAM during the packages install process, this can
# cause a reboot by the wachdog service. To prevent this situation
# stop temporaly some services to free some MB of RAM.
svc -d /service/gui/
svc -d /service/dbus-qwacs
svc -d /service/dbus-generator-starter
svc -d /service/dbus-fronius

# Install the signalk-server
npm install -g --unsafe-perm signalk-server

# Now the signalk-server is installed, configure and start it
signalk-server-setup
signalk-server

# Once the server is up and running the web interface is available on http://CCGXIPADDRESS:3000.
# The venus signalk plugin can be installed from the appstore available in the web interface.
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
