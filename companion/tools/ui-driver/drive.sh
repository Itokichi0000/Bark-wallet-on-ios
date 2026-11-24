#!/bin/bash
# usage: drive.sh <name>  (script on stdin) -> screenshots in $S/ui/<name>/
S=${S:-/tmp/bark-ui}; mkdir -p $S; D=$(cd "$(dirname "$0")" && pwd)
O=$S/ui/$1; rm -rf $O; mkdir -p $O; cat > $O/script.txt
U=$(cat $S/udid); ( for i in $(seq 1 200); do xcrun simctl spawn $U notifyutil -p com.apple.BiometricKit_Sim.pearl.match >/dev/null 2>&1; sleep 3; done ) >/dev/null 2>&1 & FACE=$!
cd $D && TEST_RUNNER_SCRIPT=$O/script.txt TEST_RUNNER_OUT=$O xcodebuild test-without-building -project Driver.xcodeproj -scheme Driver -destination "id=$(cat $S/udid)" -derivedDataPath $S/dd > $O/xc.log 2>&1
kill $FACE 2>/dev/null; pkill -P $FACE 2>/dev/null
grep -E "Executed|error:" $O/xc.log | tail -2; cat $O/log.txt 2>/dev/null
