	.file	1 "t14_half.c"
gcc2_compiled.:
__gnu_compiled_c:
	.globl	codec_freq
	.data
	.align	2
codec_freq:
	.half	14085
	.half	14112
	.half	14015
	.text
	.align	2
	.globl	load_signed
	.ent	load_signed
load_signed:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sll	$5,$5,1
	addu	$5,$5,$4
	lh	$2,0($5)
	j	$31
	.end	load_signed
	.align	2
	.globl	load_unsigned
	.ent	load_unsigned
load_unsigned:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sll	$5,$5,1
	addu	$5,$5,$4
	lhu	$2,0($5)
	j	$31
	.end	load_unsigned
	.align	2
	.globl	store_half
	.ent	store_half
store_half:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sll	$5,$5,1
	addu	$5,$5,$4
	.set	noreorder
	.set	nomacro
	j	$31
	sh	$6,0($5)
	.set	macro
	.set	reorder

	.end	store_half
	.align	2
	.globl	store_uhalf
	.ent	store_uhalf
store_uhalf:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sll	$5,$5,1
	addu	$5,$5,$4
	.set	noreorder
	.set	nomacro
	j	$31
	sh	$6,0($5)
	.set	macro
	.set	reorder

	.end	store_uhalf
	.align	2
	.globl	widen_signed
	.ent	widen_signed
widen_signed:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lh	$2,0($4)
	lh	$3,2($4)
	lh	$4,4($4)
	addu	$2,$2,$3
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$2,$2,$4
	.set	macro
	.set	reorder

	.end	widen_signed
	.align	2
	.globl	widen_unsigned
	.ent	widen_unsigned
widen_unsigned:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lhu	$2,0($4)
	lhu	$3,2($4)
	lhu	$4,4($4)
	addu	$2,$2,$3
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$2,$2,$4
	.set	macro
	.set	reorder

	.end	widen_unsigned
	.align	2
	.globl	compare_signed
	.ent	compare_signed
compare_signed:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sll	$4,$4,16
	sra	$4,$4,16
	sll	$5,$5,16
	sra	$5,$5,16
	slt	$2,$4,$5
	.set	noreorder
	.set	nomacro
	beq	$2,$0,$L11
	slt	$2,$5,$4
	.set	macro
	.set	reorder

	.set	noreorder
	.set	nomacro
	j	$31
	li	$2,-1			# 0xffffffff
	.set	macro
	.set	reorder

$L11:
	j	$31
	.end	compare_signed
	.align	2
	.globl	compare_unsigned
	.ent	compare_unsigned
compare_unsigned:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	andi	$4,$4,0xffff
	andi	$5,$5,0xffff
	sltu	$2,$4,$5
	.set	noreorder
	.set	nomacro
	beq	$2,$0,$L16
	sltu	$2,$5,$4
	.set	macro
	.set	reorder

	.set	noreorder
	.set	nomacro
	j	$31
	li	$2,-1			# 0xffffffff
	.set	macro
	.set	reorder

$L16:
	j	$31
	.end	compare_unsigned
	.align	2
	.globl	tune
	.ent	tune
tune:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	li	$2,1431633920			# 0x55550000
	ori	$2,$2,0x5556
	mult	$4,$2
	lui	$5,%hi(codec_freq) # high
	addiu	$5,$5,%lo(codec_freq) # low
	sra	$2,$4,31
	lui	$6,%hi(codec_mask) # high
	addiu	$6,$6,%lo(codec_mask) # low
	mfhi	$7
	#nop
	#nop
	subu	$2,$7,$2
	sll	$3,$2,1
	addu	$3,$3,$2
	subu	$3,$4,$3
	sll	$3,$3,1
	addu	$3,$3,$5
	andi	$5,$4,0x0003
	sll	$5,$5,1
	lhu	$2,0($3)
	addu	$5,$5,$6
	addu	$3,$2,$4
	addu	$4,$4,1
	andi	$4,$4,0x0003
	sll	$4,$4,1
	addu	$4,$4,$6
	sh	$3,0($5)
	lhu	$3,0($4)
	#nop
	subu	$2,$2,$3
	sll	$2,$2,16
	.set	noreorder
	.set	nomacro
	j	$31
	sra	$2,$2,16
	.set	macro
	.set	reorder

	.end	tune
	.align	2
	.globl	negative_half
	.ent	negative_half
negative_half:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	li	$2,-1			# 0xffffffff
	sh	$2,-2($4)
	li	$2,-2			# 0xfffffffe
	.set	noreorder
	.set	nomacro
	j	$31
	sh	$2,-4($4)
	.set	macro
	.set	reorder

	.end	negative_half

	.comm	codec_mask,8

	.text
