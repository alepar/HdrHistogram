/**
 * @license HdrHistogram-2.1.4
 * (c) Gil Tene, Michael Barker, and Matt Warren https://github.com/HdrHistogram/HdrHistogram
 * License: CC0 (BSD)
 *
 * partial port to js by alepar
 */

/*parts of j2se*/
// TODO: implement correctly
Math.ulp = function(value) {
    return value / 1000000; // probably good enough as long as we don't go too small
};

var Bitwise = {};

Bitwise.shiftLeft = function(value, shift) {
    var mult = Math.pow(2, shift);
    return Math.floor(value*mult);
};

Bitwise.shiftRight = function(value, shift) {
    var mult = Math.pow(2, shift);
    return Math.floor(value/mult);
};

var Long = {};

Long.MAX_VALUE = Math.pow(2, 63) - 1;

Long.numberOfLeadingZeros = function(i) {
    if (i === 0)
        return 64;
    var n = 1;
    var x = Bitwise.shiftRight(i, 32);
    if (x === 0) { n += 32; x = i; }
    if (Bitwise.shiftRight(x, 16) === 0) { n += 16; x = Bitwise.shiftLeft(x, 16); }
    if (Bitwise.shiftRight(x, 24) === 0) { n +=  8; x = Bitwise.shiftLeft(x,  8); }
    if (Bitwise.shiftRight(x, 28) === 0) { n +=  4; x = Bitwise.shiftLeft(x,  4); }
    if (Bitwise.shiftRight(x, 30) === 0) { n +=  2; x = Bitwise.shiftLeft(x,  2); }
    n -= Bitwise.shiftRight(x, 31);
    return n;
};

var Double = {};

Double.MAX_VALUE = (2 - Math.pow(2, -52))*Math.pow(2, 1023);

var Arrays = {};

Arrays.binarySearch = function(array, key) {
    var low = 0;
    var high = array.length - 1;

    while (low <= high) {
        var mid = (low + high) >>> 1;
        var midVal = array[mid];

        if (midVal < key)
            low = mid + 1;
        else if (midVal > key)
            high = mid - 1;
        else
            return mid;
    }
    return -(low + 1);
};

Arrays.copyOf = function(original, newLength) {
    var copy = Arrays.newArray(newLength);
    System.arraycopy(original, 0, copy, 0, Math.min(original.length, newLength));
    return copy;
};

Arrays.newArray = function(length) {
    var array = [];
    for (var i=0; i<length; i++) {
        array.push(0);
    }
    return array;
};

var System = {};

System.arraycopy = function(src, srcPos, dest, destPos, length) {
    for (var i=0; i<length; i++) {
        dest[destPos+i] = src[srcPos+i];
    }
};

/*from AbstractHistogram*/
var AbstractHistogram = {};
AbstractHistogram.numberOfSubbuckets = function(numberOfSignificantValueDigits) {
    var largestValueWithSingleUnitResolution = 2 * Math.floor(Math.pow(10, numberOfSignificantValueDigits));

    var subBucketCountMagnitude = Math.ceil(Math.log(largestValueWithSingleUnitResolution)/Math.log(2));
    var subBucketCount = Math.pow(2, subBucketCountMagnitude);
    return subBucketCount;
};

var Histogram = function(data) {
    for (var k in data) {
        if (data.hasOwnProperty(k)) {
            this[k] = data[k];
        }
    }

    if (this.totalCount === undefined || this.totalCount === null) {
        var i;
        this.totalCount = 0;
        for (i=0; i<this.counts.length; i++) {
            this.totalCount += this.counts[i];
        }
    }

    // === dummy fix for 'unresolved variable' warnings, values are expected to be populated from json, feel free to drop it ===
    //noinspection SillyAssignmentJS
    this.lowestDiscernibleValue = this.lowestDiscernibleValue;
    //noinspection SillyAssignmentJS
    this.numberOfSignificantValueDigits = this.numberOfSignificantValueDigits;
    //noinspection SillyAssignmentJS
    this.startTimeStampMsec = this.startTimeStampMsec;
    //noinspection SillyAssignmentJS
    this.endTimeStampMsec = this.endTimeStampMsec;
    // === END ===

    var largestValueWithSingleUnitResolution = 2 * Math.floor(Math.pow(10, this.numberOfSignificantValueDigits));

    this.unitMagnitude = Math.floor(Math.log(this.lowestDiscernibleValue)/Math.log(2));

    var subBucketCountMagnitude = Math.ceil(Math.log(largestValueWithSingleUnitResolution)/Math.log(2));
    this.subBucketHalfCountMagnitude = ((subBucketCountMagnitude > 1) ? subBucketCountMagnitude : 1) - 1;
    this.subBucketCount = Math.pow(2, (this.subBucketHalfCountMagnitude + 1));
    this.subBucketHalfCount = this.subBucketCount / 2;
    this.subBucketMask = Bitwise.shiftLeft((this.subBucketCount - 1), this.unitMagnitude);

    this.establishSize(this.highestTrackableValue);

    this.leadingZeroCountBase = 64 - this.unitMagnitude - this.subBucketHalfCountMagnitude - 1;

    this.autoResize = true;
};

Histogram.prototype.establishSize = function(newHighestTrackableValue) {
    this.countsArrayLength = this.determineArrayLengthNeeded(newHighestTrackableValue);
    this.bucketCount = this.getBucketsNeededToCoverValue(newHighestTrackableValue);
    this.highestTrackableValue = newHighestTrackableValue;
};

Histogram.prototype.determineArrayLengthNeeded = function(highestTrackableValue) {
    if (highestTrackableValue < 2 * this.lowestDiscernibleValue) {
        throw "highestTrackableValue (" + highestTrackableValue +
        ") cannot be < (2 * lowestDiscernibleValue)";
    }
    //determine counts array length needed:
    var countsArrayLength = this.getLengthForNumberOfBuckets(this.getBucketsNeededToCoverValue(highestTrackableValue));
    return countsArrayLength;
};

Histogram.prototype.getBucketsNeededToCoverValue = function(value) {
    var smallestUntrackableValue = Bitwise.shiftLeft(this.subBucketCount, this.unitMagnitude);
    var bucketsNeeded = 1;
    while (smallestUntrackableValue <= value) {
        if (smallestUntrackableValue > (Long.MAX_VALUE / 2)) {
            return bucketsNeeded + 1;
        }
        smallestUntrackableValue = Bitwise.shiftLeft(smallestUntrackableValue, 1);
        bucketsNeeded++;
    }
    return bucketsNeeded;
};

Histogram.prototype.getLengthForNumberOfBuckets = function(numberOfBuckets) {
    var lengthNeeded = Math.floor((numberOfBuckets + 1) * (this.subBucketCount / 2));
    return lengthNeeded;
};

Histogram.prototype.getValueAtPercentile = function(percentile) {
    var requestedPercentile = Math.min(percentile, 100);
    var countAtPercentile = Math.round((requestedPercentile / 100) * this.getTotalCount());
    countAtPercentile = Math.max(countAtPercentile, 1);

    var totalToCurrentIndex = 0;
    var i;
    for (i=0; i<this.countsArrayLength; i++) {
        totalToCurrentIndex += this.getCountAtIndex(i);
        if (totalToCurrentIndex >= countAtPercentile) {
            var valueAtIndex = this.valueFromIndex(i);
            return (percentile == 0) ?
                this.lowestEquivalentValue(valueAtIndex) :
                this.highestEquivalentValue(valueAtIndex);
        }
    }
};

Histogram.prototype.valueFromIndex = function(index) {
    var bucketIndex = Bitwise.shiftRight(index, this.subBucketHalfCountMagnitude) - 1;
    var subBucketIndex = (index & (this.subBucketHalfCount - 1)) + this.subBucketHalfCount;

    if (bucketIndex < 0) {
        subBucketIndex -= this.subBucketHalfCount;
        bucketIndex = 0;
    }
    return this.valueFromIndex2(bucketIndex, subBucketIndex);
};

Histogram.prototype.valueFromIndex2 = function(bucketIndex, subBucketIndex) {
    return Bitwise.shiftLeft(subBucketIndex, (bucketIndex + this.unitMagnitude));
};

Histogram.prototype.lowestEquivalentValue = function(value) {
    var bucketIndex = this.getBucketIndex(value);
    var subBucketIndex = this.getSubBucketIndex(value, bucketIndex);
    var thisValueBaseLevel = this.valueFromIndex2(bucketIndex, subBucketIndex);
    return thisValueBaseLevel;
};

Histogram.prototype.highestEquivalentValue = function(value) {
    return this.nextNonEquivalentValue(value) - 1;
};

Histogram.prototype.getBucketIndex = function(value) {
    return this.leadingZeroCountBase - Long.numberOfLeadingZeros(value | this.subBucketMask);
};

Histogram.prototype.getSubBucketIndex = function(value, bucketIndex) {
    return Bitwise.shiftRight(value, (bucketIndex + this.unitMagnitude));
};

Histogram.prototype.nextNonEquivalentValue = function(value) {
    return this.lowestEquivalentValue(value) + this.sizeOfEquivalentValueRange(value);
};

Histogram.prototype.sizeOfEquivalentValueRange = function(value) {
    var bucketIndex = this.getBucketIndex(value);
    var subBucketIndex = this.getSubBucketIndex(value, bucketIndex);
    var distanceToNextValue =
        Bitwise.shiftLeft(1, ( this.unitMagnitude + ((subBucketIndex >= this.subBucketCount) ? (bucketIndex + 1) : bucketIndex)));
    return distanceToNextValue;
};

Histogram.prototype.getMaxValue = function() {
    return !(this.maxValue > 0) ? 0 : this.highestEquivalentValue(this.maxValue);
};

Histogram.prototype.isAutoResize = function() {
    return this.autoResize;
};

Histogram.prototype.normalizeIndex = function(index, normalizingIndexOffset, arrayLength) {
    if (normalizingIndexOffset == 0) {
        return index;
    }
    if ((index > arrayLength) || (index < 0)) {
        throw "index out of covered value range";
    }
    var normalizedIndex = index - normalizingIndexOffset;
    if (normalizedIndex < 0) {
        normalizedIndex += arrayLength;
    } else if (normalizedIndex >= arrayLength) {
        normalizedIndex -= arrayLength;
    }
    return normalizedIndex;
};

Histogram.prototype.add = function (otherHistogram) {
    var i;
    var highestRecordableValue = this.highestEquivalentValue(this.valueFromIndex(this.countsArrayLength - 1));
    if (highestRecordableValue < otherHistogram.getMaxValue()) {
        if (!this.isAutoResize()) {
            throw "The other histogram includes values that do not fit in this histogram's range.";
        }
        this.resize(otherHistogram.getMaxValue());
    }
    var otherCount;
    if ((this.bucketCount == otherHistogram.data.bucketCount) &&
        (this.subBucketCount == otherHistogram.data.subBucketCount) &&
        (this.unitMagnitude == otherHistogram.data.unitMagnitude) &&
        (this.getNormalizingIndexOffset() == otherHistogram.getNormalizingIndexOffset())) {
        var observedOtherTotalCount = 0;
        for (i = 0; i < otherHistogram.data.countsArrayLength; i++) {
            otherCount = otherHistogram.getCountAtIndex(i);
            if (otherCount > 0) {
                this.addToCountAtIndex(i, otherCount);
                observedOtherTotalCount += otherCount;
            }
        }
        this.setTotalCount(this.getTotalCount() + observedOtherTotalCount);
        this.updatedMaxValue(Math.max(this.getMaxValue(), otherHistogram.getMaxValue()));
        this.updateMinNonZeroValue(Math.min(this.getMinNonZeroValue(), otherHistogram.getMinNonZeroValue()));
    } else {
        for (i = 0; i < otherHistogram.data.countsArrayLength; i++) {
            otherCount = otherHistogram.getCountAtIndex(i);
            if (otherCount > 0) {
                this.recordValueWithCount(otherHistogram.valueFromIndex(i), otherCount);
            }
        }
    }
    this.setStartTimeStamp(Math.min(this.startTimeStampMsec, otherHistogram.startTimeStampMsec));
    this.setEndTimeStamp(Math.max(this.endTimeStampMsec, otherHistogram.endTimeStampMsec));
};

Histogram.prototype.setStartTimeStamp = function(timeStampMsec) {
    this.startTimeStampMsec = timeStampMsec;
};

Histogram.prototype.setEndTimeStamp = function(timeStampMsec) {
    this.endTimeStampMsec = timeStampMsec;
};

Histogram.prototype.updatedMaxValue = function(value) {
    if (value > this.maxValue) {
        this.maxValue = value;
    }
};

Histogram.prototype.updateMinNonZeroValue = function(value) {
    if (value < this.minNonZeroValue) {
        this.minNonZeroValue = value;
    }
};

Histogram.prototype.getMinNonZeroValue = function() {
    return (this.minNonZeroValue == Long.MAX_VALUE) ?
        Long.MAX_VALUE : this.lowestEquivalentValue(this.minNonZeroValue);
};

Histogram.prototype.recordValueWithCount = function(value, count) {
    this.recordCountAtValue(count, value);
};

Histogram.prototype.recordCountAtValue = function(count, value) {
    var countsIndex = this.countsArrayIndex(value);
    try {
        this.addToCountAtIndex(countsIndex, count);
    } catch (ex) {
        this.handleRecordException(count, value, ex);
    }
    this.updateMinAndMax(value);
    this.addToTotalCount(count);
};

Histogram.prototype.handleRecordException = function(count, value, ex) {
    if (!this.autoResize) {
        throw "value outside of histogram covered range. Caused by: " + ex;
    }
    this.resize(value);
    var countsIndex = this.countsArrayIndex(value);
    this.addToCountAtIndex(countsIndex, count);
    this.highestTrackableValue = this.highestEquivalentValue(this.valueFromIndex(this.countsArrayLength - 1));
};

Histogram.prototype.countsArrayIndex = function(value) {
    if (value < 0) {
        throw "Histogram recorded value cannot be negative.";
    }
    var bucketIndex = this.getBucketIndex(value);
    var subBucketIndex = this.getSubBucketIndex(value, bucketIndex);
    return this.countsArrayIndex2(bucketIndex, subBucketIndex);
};

Histogram.prototype.countsArrayIndex2 = function(bucketIndex, subBucketIndex) {
    this.assert(subBucketIndex < this.subBucketCount);
    this.assert(bucketIndex == 0 || (subBucketIndex >= this.subBucketHalfCount));
    var bucketBaseIndex = Bitwise.shiftLeft((bucketIndex + 1), this.subBucketHalfCountMagnitude);
    var offsetInBucket = subBucketIndex - this.subBucketHalfCount;
    return bucketBaseIndex + offsetInBucket;
};

Histogram.prototype.assert = function(value) {
    if (!value) {
        throw "assert failed";
    }
};

Histogram.prototype.updateMinAndMax = function(value) {
    if (value > this.maxValue) {
        this.updatedMaxValue(value);
    }
    if ((value < this.minNonZeroValue) && (value != 0)) {
        this.updateMinNonZeroValue(value);
    }
};

Histogram.prototype.shiftValuesLeft = function(numberOfBinaryOrdersOfMagnitude) {
    if (numberOfBinaryOrdersOfMagnitude < 0) {
        throw "Cannot shift by a negative number of magnitudes";
    }

    if (numberOfBinaryOrdersOfMagnitude === 0) {
        return;
    }
    if (this.getTotalCount() === this.getCountAtIndex(0)) {
        return;
    }

    var shiftAmount = Bitwise.shiftLeft(numberOfBinaryOrdersOfMagnitude, this.subBucketHalfCountMagnitude);
    var maxValueIndex = this.countsArrayIndex(this.getMaxValue());
    if (maxValueIndex >= (this.countsArrayLength - shiftAmount)) {
        throw "Operation would overflow, would discard recorded value counts";
    }

    var maxValueBeforeShift = this.maxValue; this.maxValue = 0;
    var minNonZeroValueBeforeShift = this.minNonZeroValue; this.minNonZeroValue = Long.MAX_VALUE;

    var lowestHalfBucketPopulated = (minNonZeroValueBeforeShift < this.subBucketHalfCount);

    this.shiftNormalizingIndexByOffset(shiftAmount, lowestHalfBucketPopulated);

    this.updateMinAndMax(Bitwise.shiftLeft(maxValueBeforeShift, numberOfBinaryOrdersOfMagnitude));
    if (minNonZeroValueBeforeShift < Long.MAX_VALUE) {
        this.updateMinAndMax(Bitwise.shiftLeft(minNonZeroValueBeforeShift, numberOfBinaryOrdersOfMagnitude));
    }
};

Histogram.prototype.nonConcurrentNormalizingIndexShift = function(shiftAmount, lowestHalfBucketPopulated) {
    var zeroValueCount = this.getCountAtIndex(0);
    this.setCountAtIndex(0, 0);

    this.setNormalizingIndexOffset(this.getNormalizingIndexOffset() + shiftAmount);

    if (lowestHalfBucketPopulated) {
        this.shiftLowestHalfBucketContentsLeft(shiftAmount);
    }

    this.setCountAtIndex(0, zeroValueCount);
};

Histogram.prototype.shiftLowestHalfBucketContentsLeft = function(shiftAmount) {
    var numberOfBinaryOrdersOfMagnitude = Bitwise.shiftRight(shiftAmount, this.subBucketHalfCountMagnitude);

    for (var fromIndex = 1; fromIndex < this.subBucketHalfCount; fromIndex++) {
        var toValue = Bitwise.shiftLeft(this.valueFromIndex(fromIndex), numberOfBinaryOrdersOfMagnitude);
        var toIndex = this.countsArrayIndex(toValue);
        var countAtFromIndex = this.getCountAtNormalizedIndex(fromIndex);
        this.setCountAtIndex(toIndex, countAtFromIndex);
        this.setCountAtNormalizedIndex(fromIndex, 0);
    }
};

Histogram.prototype.shiftValuesRight = function(numberOfBinaryOrdersOfMagnitude) {
    if (numberOfBinaryOrdersOfMagnitude < 0) {
        throw "Cannot shift by a negative number of magnitudes";
    }

    if (numberOfBinaryOrdersOfMagnitude === 0) {
        return;
    }
    if (this.getTotalCount() === this.getCountAtIndex(0)) {
        return;
    }

    var shiftAmount = this.subBucketHalfCount * numberOfBinaryOrdersOfMagnitude;

    var minNonZeroValueIndex = this.countsArrayIndex(this.getMinNonZeroValue());
    if (minNonZeroValueIndex < shiftAmount + this.subBucketHalfCount) {
        throw "Operation would underflow and lose precision of already recorded value counts";
    }

    var maxValueBeforeShift = this.maxValue; this.maxValue = 0;
    var minNonZeroValueBeforeShift = this.minNonZeroValue; this.minNonZeroValue = Long.MAX_VALUE;

    // move normalizingIndexOffset
    this.shiftNormalizingIndexByOffset(-shiftAmount, false);

    // adjust min, max:
    this.updateMinAndMax(Bitwise.shiftRight(maxValueBeforeShift, numberOfBinaryOrdersOfMagnitude));
    if (minNonZeroValueBeforeShift < Long.MAX_VALUE) {
        this.updateMinAndMax(Bitwise.shiftRight(minNonZeroValueBeforeShift, numberOfBinaryOrdersOfMagnitude));
    }
};

/*from Histogram*/
Histogram.prototype.getTotalCount = function() {
    return this.totalCount;
};

Histogram.prototype.resize = function(newHighestTrackableValue) {
    var oldNormalizedZeroIndex = this.normalizeIndex(0, this.normalizingIndexOffset, this.countsArrayLength);

    this.establishSize(newHighestTrackableValue);

    var countsDelta = this.countsArrayLength - this.counts.length;

    this.counts = Arrays.copyOf(this.counts, this.countsArrayLength);

    if (oldNormalizedZeroIndex != 0) {
        var newNormalizedZeroIndex = oldNormalizedZeroIndex + countsDelta;
        var lengthToCopy = (this.countsArrayLength - countsDelta) - oldNormalizedZeroIndex;
        System.arraycopy(this.counts, oldNormalizedZeroIndex, this.counts, newNormalizedZeroIndex, lengthToCopy);
    }
};

Histogram.prototype.getNormalizingIndexOffset = function() {
    return this.normalizingIndexOffset;
};

Histogram.prototype.getCountAtIndex = function(index) {
    return this.counts[this.normalizeIndex(index, this.normalizingIndexOffset, this.countsArrayLength)];
};

Histogram.prototype.addToCountAtIndex = function(index, value) {
    var normalizedIndex = this.normalizeIndex(index, this.normalizingIndexOffset, this.countsArrayLength);
    if (normalizedIndex < 0 || normalizedIndex >= this.counts.length) {
        throw "index out of bound: normalizedIndex=" + normalizedIndex +"; length:"+this.counts.length;
    }
    this.counts[normalizedIndex] += value;
};

Histogram.prototype.setTotalCount = function(totalCount) {
    this.totalCount = totalCount;
};

Histogram.prototype.addToTotalCount = function(value) {
    this.totalCount += value;
};

Histogram.prototype.getLowestDiscernibleValue = function() {
    return this.lowestDiscernibleValue;
};

Histogram.prototype.getHighestTrackableValue = function() {
    return this.highestTrackableValue;
};

Histogram.prototype.getNumberOfSignificantValueDigits = function() {
    return this.numberOfSignificantValueDigits;
};

Histogram.prototype.getIntegerToDoubleValueConversionRatio = function() {
    return this.integerToDoubleValueConversionRatio;
};

Histogram.prototype.setIntegerToDoubleValueConversionRatio = function(value) {
    this.integerToDoubleValueConversionRatio = value;
};

Histogram.prototype.shiftNormalizingIndexByOffset = function(offsetToAdd, lowestHalfBucketPopulated) {
    this.nonConcurrentNormalizingIndexShift(offsetToAdd, lowestHalfBucketPopulated);
};

Histogram.prototype.setCountAtIndex = function(index, value) {
    this.counts[this.normalizeIndex(index, this.normalizingIndexOffset, this.countsArrayLength)] = value;
};

Histogram.prototype.setNormalizingIndexOffset = function(normalizingIndexOffset) {
    this.normalizingIndexOffset = normalizingIndexOffset;
};

Histogram.prototype.getCountAtNormalizedIndex = function(index) {
    return this.counts[index];
};

Histogram.prototype.setCountAtNormalizedIndex = function(index, value) {
    this.counts[index] = value;
};

Histogram.prototype.getMean = function() {
    if (this.getTotalCount() == 0) {
        return 0.0;
    }

    var totalValue = 0;
    var i;

    for(i=0; i<this.counts.length; i++) {
        if (this.getCountAtIndex(i) > 0) {
            totalValue += this.medianEquivalentValue(this.valueFromIndex(i)) * this.getCountAtIndex(i);
        }
    }

    return totalValue / this.getTotalCount();
};

Histogram.prototype.medianEquivalentValue = function(value) {
    return (this.lowestEquivalentValue(value) + Bitwise.shiftRight(this.sizeOfEquivalentValueRange(value), 1));
};

/*from DoubleHistogram*/
var DoubleHistogram = function(data) {
    this.autoResize = true;
    var valuesHistogram = new Histogram(data.integerValuesHistogram);

    for (var k in data) {
        if (k !== "integerValuesHistogram" && data.hasOwnProperty(k)) {
            this[k] = data[k];
        }
    }

    var integerValueRange = this.deriveIntegerValueRange(this.configuredHighestToLowestValueRatio, valuesHistogram.numberOfSignificantValueDigits);

    if ((valuesHistogram.getLowestDiscernibleValue() !== 1) ||
        (valuesHistogram.getHighestTrackableValue() !== integerValueRange - 1) ||
        valuesHistogram.getNumberOfSignificantValueDigits() !== this.numberOfSignificantValueDigits) {
        throw "integer values histogram does not match stated parameters.";
    }
    var initialLowestValueInAutoRange =
        valuesHistogram.getIntegerToDoubleValueConversionRatio() *
        valuesHistogram.subBucketHalfCount;

    this.init(this.configuredHighestToLowestValueRatio, initialLowestValueInAutoRange, valuesHistogram);
};

DoubleHistogram.prototype.init = function(configuredHighestToLowestValueRatio, lowestTrackableUnitValue, integerValuesHistogram) {
    this.configuredHighestToLowestValueRatio = configuredHighestToLowestValueRatio;
    this.integerValuesHistogram = integerValuesHistogram;
    var internalHighestToLowestValueRatio =
        this.deriveInternalHighestToLowestValueRatio(configuredHighestToLowestValueRatio);
    this.setTrackableValueRange(lowestTrackableUnitValue, lowestTrackableUnitValue * internalHighestToLowestValueRatio);
};

DoubleHistogram.prototype.deriveIntegerValueRange = function(externalHighestToLowestValueRatio, numberOfSignificantValueDigits) {
    var internalHighestToLowestValueRatio =
        this.deriveInternalHighestToLowestValueRatio(externalHighestToLowestValueRatio);

    var lowestTackingIntegerValue = AbstractHistogram.numberOfSubbuckets(numberOfSignificantValueDigits) / 2;
    var integerValueRange = lowestTackingIntegerValue * internalHighestToLowestValueRatio;

    return integerValueRange;
};


DoubleHistogram.prototype.deriveInternalHighestToLowestValueRatio = function(externalHighestToLowestValueRatio) {
    var internalHighestToLowestValueRatio =
        Bitwise.shiftLeft(1, DoubleHistogram.findContainingBinaryOrderOfMagnitude_long(externalHighestToLowestValueRatio) + 1);
    return internalHighestToLowestValueRatio;
};

DoubleHistogram.prototype.setTrackableValueRange = function(lowestValueInAutoRange, highestValueInAutoRange) {
    this.currentLowestValueInAutoRange = lowestValueInAutoRange;
    this.currentHighestValueLimitInAutoRange = highestValueInAutoRange;
    this.integerToDoubleValueConversionRatio = lowestValueInAutoRange / this.getLowestTrackingIntegerValue();
    this.doubleToIntegerValueConversionRatio= 1.0 / this.integerToDoubleValueConversionRatio;
    this.integerValuesHistogram.setIntegerToDoubleValueConversionRatio(this.integerToDoubleValueConversionRatio);
};

DoubleHistogram.findContainingBinaryOrderOfMagnitude_long = function(longNumber){
    var pow2ceiling = 64 - Long.numberOfLeadingZeros(longNumber);
    return pow2ceiling;
};

DoubleHistogram.findContainingBinaryOrderOfMagnitude_double = function(doubleNumber) {
    var longNumber = Math.ceil(doubleNumber);
    return DoubleHistogram.findContainingBinaryOrderOfMagnitude_long(longNumber);
};

DoubleHistogram.prototype.getLowestTrackingIntegerValue = function() {
    return this.integerValuesHistogram.subBucketHalfCount;
};

DoubleHistogram.prototype.add = function(fromHistogram) {
    var arrayLength = fromHistogram.integerValuesHistogram.countsArrayLength;
    var fromIntegerHistogram = fromHistogram.integerValuesHistogram;
    for (var i = 0; i < arrayLength; i++) {
        var count = fromIntegerHistogram.getCountAtIndex(i);
        if (count > 0) {
            this.recordValueWithCount(
                fromIntegerHistogram.valueFromIndex(i) *
                fromHistogram.integerToDoubleValueConversionRatio,
                count);
        }
    }
};

DoubleHistogram.prototype.recordValueWithCount = function(value, count) {
    this.recordCountAtValue(count, value);
};

DoubleHistogram.prototype.recordCountAtValue = function(count, value) {
    if ((value < this.currentLowestValueInAutoRange) || (value >= this.currentHighestValueLimitInAutoRange)) {
        // Zero is valid and needs no auto-ranging, but also rare enough that we should deal
        // with it on the slow path...
        this.autoAdjustRangeForValue(value);
    }

    var integerValue = Math.floor(value * this.doubleToIntegerValueConversionRatio);
    this.integerValuesHistogram.recordValueWithCount(integerValue, count);
};

DoubleHistogram.prototype.autoAdjustRangeForValue = function(value) {
    if (value == 0.0) {
        return;
    }
    this.autoAdjustRangeForValueSlowPath(value);
};

DoubleHistogram.prototype.autoAdjustRangeForValueSlowPath = function(value) {
    var shiftAmount;
    if (value < this.currentLowestValueInAutoRange) {
        if (value < 0.0) {
            throw "Negative values cannot be recorded";
        }
        do {
            shiftAmount =
                this.findCappedContainingBinaryOrderOfMagnitude(
                    Math.ceil(this.currentLowestValueInAutoRange / value) - 1.0);
            this.shiftCoveredRangeToTheRight(shiftAmount);
        } while (value < this.currentLowestValueInAutoRange);
    } else if (value >= this.currentHighestValueLimitInAutoRange) {
        if (value > DoubleHistogram.highestAllowedValueEver) {
            throw "Values above " + DoubleHistogram.highestAllowedValueEver + " cannot be recorded";
        }
        do {
            shiftAmount =
                this.findCappedContainingBinaryOrderOfMagnitude(
                    Math.ceil((value + Math.ulp(value)) / this.currentHighestValueLimitInAutoRange) - 1.0);
            this.shiftCoveredRangeToTheLeft(shiftAmount);
        } while (value >= this.currentHighestValueLimitInAutoRange);
    }
};

DoubleHistogram.highestAllowedValueEver = function(){
    var value = 1.0;
    while (value < Double.MAX_VALUE / 4.0) {
        value *= 2;
    }
    return value;
}();

DoubleHistogram.prototype.findCappedContainingBinaryOrderOfMagnitude = function(doubleNumber) {
    if (doubleNumber > this.configuredHighestToLowestValueRatio) {
        return Math.floor(Math.log(this.configuredHighestToLowestValueRatio)/Math.log(2));
    }
    if (doubleNumber > Math.pow(2.0, 50)) {
        return 50;
    }
    return DoubleHistogram.findContainingBinaryOrderOfMagnitude_double(doubleNumber);
};

DoubleHistogram.prototype.shiftCoveredRangeToTheRight = function(numberOfBinaryOrdersOfMagnitude) {
    var newLowestValueInAutoRange = this.currentLowestValueInAutoRange;
    var newHighestValueLimitInAutoRange = this.currentHighestValueLimitInAutoRange;

    try {
        var shiftMultiplier = 1.0 / Bitwise.shiftLeft(1, numberOfBinaryOrdersOfMagnitude);

        this.currentHighestValueLimitInAutoRange *= shiftMultiplier;

        if (this.getTotalCount() > this.integerValuesHistogram.getCountAtIndex(0)) {
            try {
                this.integerValuesHistogram.shiftValuesLeft(numberOfBinaryOrdersOfMagnitude);
            } catch (ex) {
                this.handleShiftValuesException(numberOfBinaryOrdersOfMagnitude, ex);
                newHighestValueLimitInAutoRange /= shiftMultiplier;
                this.integerValuesHistogram.shiftValuesLeft(numberOfBinaryOrdersOfMagnitude);
            }
        }
        newLowestValueInAutoRange *= shiftMultiplier;
        newHighestValueLimitInAutoRange *= shiftMultiplier;
    } finally {
        this.setTrackableValueRange(newLowestValueInAutoRange, newHighestValueLimitInAutoRange);
    }
};

DoubleHistogram.prototype.shiftCoveredRangeToTheLeft = function(numberOfBinaryOrdersOfMagnitude) {
    var newLowestValueInAutoRange = this.currentLowestValueInAutoRange;
    var newHighestValueLimitInAutoRange = this.currentHighestValueLimitInAutoRange;

    try {
        var shiftMultiplier = 1.0 * Bitwise.shiftLeft(1, numberOfBinaryOrdersOfMagnitude);

        this.currentLowestValueInAutoRange *= shiftMultiplier;

        if (this.getTotalCount() > this.integerValuesHistogram.getCountAtIndex(0)) {
            try {
                this.integerValuesHistogram.shiftValuesRight(numberOfBinaryOrdersOfMagnitude);
                newLowestValueInAutoRange *= shiftMultiplier;
                newHighestValueLimitInAutoRange *= shiftMultiplier;
            } catch (ex) {
                this.handleShiftValuesException(numberOfBinaryOrdersOfMagnitude, ex);
                newLowestValueInAutoRange /= shiftMultiplier;
            }
        }
        newLowestValueInAutoRange *= shiftMultiplier;
        newHighestValueLimitInAutoRange *= shiftMultiplier;
    } finally {
        this.setTrackableValueRange(newLowestValueInAutoRange, newHighestValueLimitInAutoRange);
    }
};

DoubleHistogram.prototype.getTotalCount = function() {
    return this.integerValuesHistogram.getTotalCount();
};

DoubleHistogram.prototype.handleShiftValuesException = function(numberOfBinaryOrdersOfMagnitude, ex) {
    if (!this.autoResize) {
        throw "value outside of histogram covered range. Caused by: " + ex;
    }

    var highestTrackableValue = this.integerValuesHistogram.getHighestTrackableValue();
    var highestTrackableValueContainingOrderOfMagnitude =
        DoubleHistogram.findContainingBinaryOrderOfMagnitude_long(highestTrackableValue);
    var newHighestTrackableValue =
        Bitwise.shiftLeft(1, (numberOfBinaryOrdersOfMagnitude + highestTrackableValueContainingOrderOfMagnitude)) - 1;
    if (newHighestTrackableValue < highestTrackableValue) {
        throw "cannot resize histogram covered range beyond (1L << 63) / (1L << " +
        (this.integerValuesHistogram.subBucketHalfCountMagnitude) + ") - 1.\n" +
        "Caused by:" + ex;
    }
    this.integerValuesHistogram.resize(newHighestTrackableValue);
    this.integerValuesHistogram.highestTrackableValue = newHighestTrackableValue;
    this.configuredHighestToLowestValueRatio = Bitwise.shiftLeft(this.configuredHighestToLowestValueRatio, numberOfBinaryOrdersOfMagnitude);
};

DoubleHistogram.prototype.getHighestToLowestValueRatio = function() {
    return this.configuredHighestToLowestValueRatio;
};

DoubleHistogram.prototype.getMean = function() {
    return this.integerValuesHistogram.getMean() * this.integerToDoubleValueConversionRatio;
};

DoubleHistogram.prototype.getValueAtPercentile = function(percentile) {
    return this.integerValuesHistogram.getValueAtPercentile(percentile) * this.integerToDoubleValueConversionRatio;
};

DoubleHistogram.prototype.getMaxValue = function() {
    return this.integerValuesHistogram.getMaxValue() * this.integerToDoubleValueConversionRatio;
};