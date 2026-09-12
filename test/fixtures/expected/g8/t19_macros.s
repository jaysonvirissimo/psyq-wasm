	.file	1 "t19_macros.c"
gcc2_compiled.:
__gnu_compiled_c:
	.text
	.align	2
	.globl	codec_freq
	.align	2
	.globl	square_plus
	.rdata
	.align	2
$LC0:
	.ascii	"14085 campbell\000"
	.text
	.align	2
	.globl	codec_name
	.rdata
	.align	2
$LC1:
	.ascii	"t19_macros.c\000"
	.text
	.align	2
	.globl	where
	.align	2
	.globl	line
	.align	2
	.globl	gnuc

	.text
	.text
	.ent	codec_freq
codec_freq:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	li	$2,14085			# 0x00003705
	.set	macro
	.set	reorder

	.end	codec_freq
	.text
	.ent	square_plus
square_plus:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	bgtz	$4,$L3
	mult	$4,$4
	.set	macro
	.set	reorder

	li	$4,1			# 0x00000001
$L3:
	mflo	$3
	#nop
	#nop
	addu	$2,$3,$4
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$2,$2,1
	.set	macro
	.set	reorder

	.end	square_plus
	.text
	.ent	codec_name
codec_name:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lui	$2,%hi($LC0) # high
	.set	noreorder
	.set	nomacro
	j	$31
	addiu	$2,$2,%lo($LC0) # low
	.set	macro
	.set	reorder

	.end	codec_name
	.text
	.ent	where
where:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lui	$2,%hi($LC1) # high
	.set	noreorder
	.set	nomacro
	j	$31
	addiu	$2,$2,%lo($LC1) # low
	.set	macro
	.set	reorder

	.end	where
	.text
	.ent	line
line:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	li	$2,34			# 0x00000022
	.set	macro
	.set	reorder

	.end	line
	.text
	.ent	gnuc
gnuc:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	li	$2,2			# 0x00000002
	.set	macro
	.set	reorder

	.end	gnuc
