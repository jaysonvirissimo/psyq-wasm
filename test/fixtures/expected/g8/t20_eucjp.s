	.file	1 "t20_eucjp.c"
gcc2_compiled.:
__gnu_compiled_c:
	.rdata
	.align	2
$LC0:
	.ascii	"\274\376\307\310\277\364 140.85\000"
	.text
	.align	2
	.globl	codec_label
	.rdata
	.align	2
$LC1:
	.ascii	"\245\354\241\274\245\267\245\347\245\363\000"
	.text
	.align	2
	.globl	ration_label
	.align	2
	.globl	label_length

	.text
	.text
	.ent	codec_label
codec_label:
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

	.end	codec_label
	.text
	.ent	ration_label
ration_label:
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

	.end	ration_label
	.text
	.ent	label_length
label_length:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	li	$2,4			# 0x00000004
	.set	macro
	.set	reorder

	.end	label_length
