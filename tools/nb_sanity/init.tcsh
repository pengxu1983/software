#!/tool/pandora64/bin/tcsh
mkdir ~/nbifweb_client
cd ~/nbifweb_client
git clone https://github.com/pengxu1983/software.git
#.cshrc
echo 'set path = ( ~/nbifweb_client/software/node/bin $path)' >> ~/.cshrc
